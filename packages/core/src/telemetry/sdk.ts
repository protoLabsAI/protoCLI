/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter as OTLPLogExporterHttp } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter as OTLPMetricExporterHttp } from '@opentelemetry/exporter-metrics-otlp-http';
import { CompressionAlgorithm } from '@opentelemetry/otlp-exporter-base';
import { Metadata } from '@grpc/grpc-js';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-node';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import type { Config } from '../config/config.js';
import { SERVICE_NAME } from './constants.js';
import { initializeMetrics } from './metrics.js';
import {
  FileLogExporter,
  FileMetricExporter,
  FileSpanExporter,
} from './file-exporters.js';
import { createDebugLogger } from '../utils/debugLogger.js';

// OTEL diagnostics are silenced by default to prevent connection errors from
// leaking into the terminal. Set PROTO_OTEL_DEBUG=1 to enable verbose logging.
if (process.env?.['PROTO_OTEL_DEBUG']) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

let sdk: NodeSDK | undefined;
let telemetryInitialized = false;

interface LangfuseExporters {
  spanProcessor: BatchSpanProcessor;
  logExporter: OTLPLogExporterHttp;
  metricExporter: OTLPMetricExporterHttp;
}

function buildLangfuseExporters(): LangfuseExporters | null {
  const publicKey = process.env['LANGFUSE_PUBLIC_KEY'];
  const secretKey = process.env['LANGFUSE_SECRET_KEY'];
  const baseUrl =
    process.env['LANGFUSE_BASE_URL'] ?? 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey) {
    return null;
  }

  const credentials = Buffer.from(`${publicKey}:${secretKey}`).toString(
    'base64',
  );
  const headers = { Authorization: `Basic ${credentials}` };

  const spanProcessor = new BatchSpanProcessor(
    new OTLPTraceExporterHttp({
      url: `${baseUrl}/api/public/otel/v1/traces`,
      headers,
    }),
  );
  const logExporter = new OTLPLogExporterHttp({
    url: `${baseUrl}/api/public/otel/v1/logs`,
    headers,
  });
  const metricExporter = new OTLPMetricExporterHttp({
    url: `${baseUrl}/api/public/otel/v1/metrics`,
    headers,
  });

  return { spanProcessor, logExporter, metricExporter };
}

export function isTelemetrySdkInitialized(): boolean {
  return telemetryInitialized;
}

function parseOtlpEndpoint(
  otlpEndpointSetting: string | undefined,
  protocol: 'grpc' | 'http',
): string | undefined {
  if (!otlpEndpointSetting) {
    return undefined;
  }
  // Trim leading/trailing quotes that might come from env variables
  const trimmedEndpoint = otlpEndpointSetting.replace(/^["']|["']$/g, '');

  try {
    const url = new URL(trimmedEndpoint);
    if (protocol === 'grpc') {
      // OTLP gRPC exporters expect an endpoint in the format scheme://host:port
      // The `origin` property provides this, stripping any path, query, or hash.
      return url.origin;
    }
    // For http, use the full href.
    return url.href;
  } catch (error) {
    diag.error('Invalid OTLP endpoint URL provided:', trimmedEndpoint, error);
    return undefined;
  }
}

export function initializeTelemetry(config: Config): void {
  const debugLogger = createDebugLogger('OTEL');

  // Opt-in policy: telemetry.enabled === true is required for ANY outbound
  // telemetry to activate (OTLP, Langfuse, file exporters). Default is false.
  // Previously Langfuse env vars alone could activate an exporter without an
  // explicit opt-in — that's been tightened so privacy is the default.
  if (telemetryInitialized || !config.getTelemetryEnabled()) {
    if (
      !telemetryInitialized &&
      (process.env['LANGFUSE_PUBLIC_KEY'] || process.env['LANGFUSE_SECRET_KEY'])
    ) {
      debugLogger.debug(
        'Langfuse env vars detected but telemetry.enabled is false — skipping. Set telemetry.enabled = true in settings to opt in.',
      );
    }
    return;
  }

  const langfuse = buildLangfuseExporters();
  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.version,
    'session.id': config.getSessionId(),
  });

  const otlpEndpoint = config.getTelemetryOtlpEndpoint();
  const otlpProtocol = config.getTelemetryOtlpProtocol();
  const parsedEndpoint = parseOtlpEndpoint(otlpEndpoint, otlpProtocol);
  const telemetryOutfile = config.getTelemetryOutfile();
  // OTLP export requires telemetry.enabled — the endpoint alone defaults to
  // localhost:4317, so without this gate a Langfuse-only user would still
  // get a gRPC exporter aimed at localhost spamming ECONNREFUSED.
  const useOtlp =
    config.getTelemetryEnabled() && !!parsedEndpoint && !telemetryOutfile;

  // No destination configured — skip SDK init to avoid flooding the console.
  if (!useOtlp && !telemetryOutfile && !langfuse) {
    return;
  }

  let spanExporter:
    | OTLPTraceExporter
    | OTLPTraceExporterHttp
    | FileSpanExporter
    | ConsoleSpanExporter;
  let logExporter: OTLPLogExporter | OTLPLogExporterHttp | FileLogExporter;
  let metricReader: PeriodicExportingMetricReader;

  if (useOtlp) {
    // Bearer token for the homelab OTLP ingress (otel.proto-labs.ai). Read from
    // env so it composes with Infisical-managed secrets without needing a
    // settings.json field. Falls back to no auth when unset — the ingress
    // returns 401 in that case, which surfaces as an export error in the
    // OTel SDK's debug logs.
    const otlpAuthToken = process.env['OTEL_INGRESS_TOKEN'];
    const otlpHeaders = otlpAuthToken
      ? { Authorization: `Bearer ${otlpAuthToken}` }
      : undefined;
    if (!otlpAuthToken && /otel\.proto-labs\.ai/.test(parsedEndpoint ?? '')) {
      debugLogger.debug(
        'OTEL_INGRESS_TOKEN not set; OTLP exports to otel.proto-labs.ai will return 401.',
      );
    }
    if (otlpProtocol === 'http') {
      const httpAuth = otlpHeaders ? { headers: otlpHeaders } : {};
      spanExporter = new OTLPTraceExporterHttp({
        url: parsedEndpoint,
        ...httpAuth,
      });
      logExporter = new OTLPLogExporterHttp({
        url: parsedEndpoint,
        ...httpAuth,
      });
      metricReader = new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporterHttp({
          url: parsedEndpoint,
          ...httpAuth,
        }),
        exportIntervalMillis: 10000,
      });
    } else {
      // grpc — auth header travels via metadata (different OTel SDK shape).
      const grpcAuth = otlpAuthToken
        ? (() => {
            const m = new Metadata();
            m.set('authorization', `Bearer ${otlpAuthToken}`);
            return { metadata: m };
          })()
        : {};
      spanExporter = new OTLPTraceExporter({
        url: parsedEndpoint,
        compression: CompressionAlgorithm.GZIP,
        ...grpcAuth,
      });
      logExporter = new OTLPLogExporter({
        url: parsedEndpoint,
        compression: CompressionAlgorithm.GZIP,
        ...grpcAuth,
      });
      metricReader = new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: parsedEndpoint,
          compression: CompressionAlgorithm.GZIP,
          ...grpcAuth,
        }),
        exportIntervalMillis: 10000,
      });
    }
  } else if (telemetryOutfile) {
    spanExporter = new FileSpanExporter(telemetryOutfile);
    logExporter = new FileLogExporter(telemetryOutfile);
    metricReader = new PeriodicExportingMetricReader({
      exporter: new FileMetricExporter(telemetryOutfile),
      exportIntervalMillis: 10000,
    });
  } else {
    // Langfuse-only: route logs and metrics to Langfuse OTLP endpoints so they
    // don't fall back to the console exporters and spam the terminal.
    spanExporter = new ConsoleSpanExporter(); // unused — langfuse.spanProcessor handles spans
    logExporter = langfuse!.logExporter;
    metricReader = new PeriodicExportingMetricReader({
      exporter: langfuse!.metricExporter,
      exportIntervalMillis: 10000,
    });
  }

  const spanProcessors: BatchSpanProcessor[] = [];
  if (useOtlp || telemetryOutfile) {
    spanProcessors.push(new BatchSpanProcessor(spanExporter!));
  }
  if (langfuse) {
    spanProcessors.push(langfuse.spanProcessor);
    debugLogger.debug('Langfuse span processor enabled.');
  }

  sdk = new NodeSDK({
    resource,
    spanProcessors,
    logRecordProcessors: [new BatchLogRecordProcessor(logExporter)],
    metricReader,
    instrumentations: [new HttpInstrumentation()],
  });

  try {
    sdk.start();
    debugLogger.debug('OpenTelemetry SDK started successfully.');
    telemetryInitialized = true;
    initializeMetrics(config);
  } catch (error) {
    debugLogger.error('Error starting OpenTelemetry SDK:', error);
  }

  process.on('SIGTERM', () => {
    shutdownTelemetry();
  });
  process.on('SIGINT', () => {
    shutdownTelemetry();
  });
  process.on('exit', () => {
    shutdownTelemetry();
  });
}

export async function shutdownTelemetry(): Promise<void> {
  if (!telemetryInitialized || !sdk) {
    return;
  }
  const debugLogger = createDebugLogger('OTEL');
  try {
    await sdk.shutdown();
    debugLogger.debug('OpenTelemetry SDK shut down successfully.');
  } catch (error) {
    debugLogger.error('Error shutting down SDK:', error);
  } finally {
    telemetryInitialized = false;
  }
}
