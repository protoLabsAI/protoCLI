/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const SERVICE_NAME = 'proto-cli';

export const EVENT_USER_PROMPT = 'proto.user_prompt';
export const EVENT_USER_RETRY = 'proto.user_retry';
export const EVENT_TOOL_CALL = 'proto.tool_call';
export const EVENT_API_REQUEST = 'proto.api_request';
export const EVENT_API_ERROR = 'proto.api_error';
export const EVENT_API_CANCEL = 'proto.api_cancel';
export const EVENT_API_RESPONSE = 'proto.api_response';
export const EVENT_CLI_CONFIG = 'proto.config';
export const EVENT_EXTENSION_DISABLE = 'proto.extension_disable';
export const EVENT_EXTENSION_ENABLE = 'proto.extension_enable';
export const EVENT_EXTENSION_INSTALL = 'proto.extension_install';
export const EVENT_EXTENSION_UNINSTALL = 'proto.extension_uninstall';
export const EVENT_EXTENSION_UPDATE = 'proto.extension_update';
export const EVENT_FLASH_FALLBACK = 'proto.flash_fallback';
export const EVENT_RIPGREP_FALLBACK = 'proto.ripgrep_fallback';
export const EVENT_NEXT_SPEAKER_CHECK = 'proto.next_speaker_check';
export const EVENT_SLASH_COMMAND = 'proto.slash_command';
export const EVENT_IDE_CONNECTION = 'proto.ide_connection';
export const EVENT_CHAT_COMPRESSION = 'proto.chat_compression';
export const EVENT_INVALID_CHUNK = 'proto.chat.invalid_chunk';
export const EVENT_CONTENT_RETRY = 'proto.chat.content_retry';
export const EVENT_CONTENT_RETRY_FAILURE = 'proto.chat.content_retry_failure';
export const EVENT_CONVERSATION_FINISHED = 'proto.conversation_finished';
export const EVENT_MALFORMED_JSON_RESPONSE = 'proto.malformed_json_response';
export const EVENT_FILE_OPERATION = 'proto.file_operation';
export const EVENT_MODEL_SLASH_COMMAND = 'proto.slash_command.model';
export const EVENT_SUBAGENT_EXECUTION = 'proto.subagent_execution';
export const EVENT_SKILL_LAUNCH = 'proto.skill_launch';
export const EVENT_HOOK_CALL = 'proto.hook_call';
export const EVENT_LOOP_DETECTION_DISABLED = 'proto.loop_detection_disabled';
export const EVENT_AUTH = 'proto.auth';
export const EVENT_USER_FEEDBACK = 'proto.user_feedback';

// Prompt Suggestion Events
export const EVENT_PROMPT_SUGGESTION = 'proto.prompt_suggestion';
export const EVENT_SPECULATION = 'proto.speculation';

// Harness Events — captured for Langfuse fine-tuning datasets
export const EVENT_HARNESS_DOOM_LOOP = 'proto.harness.doom_loop';
export const EVENT_HARNESS_SCOPE_VIOLATION = 'proto.harness.scope_violation';
export const EVENT_HARNESS_VERIFICATION_FAILED =
  'proto.harness.verification_failed';
export const EVENT_HARNESS_CHECKPOINT = 'proto.harness.checkpoint';
export const EVENT_HARNESS_OBSERVATION_MASK = 'proto.harness.observation_mask';
export const EVENT_HARNESS_SPRINT_CONTRACT = 'proto.harness.sprint_contract';
export const EVENT_HARNESS_REMINDER = 'proto.harness.reminder';

// Performance Events
export const EVENT_STARTUP_PERFORMANCE = 'proto.startup.performance';
export const EVENT_MEMORY_USAGE = 'proto.memory.usage';
export const EVENT_PERFORMANCE_BASELINE = 'proto.performance.baseline';
export const EVENT_PERFORMANCE_REGRESSION = 'proto.performance.regression';
