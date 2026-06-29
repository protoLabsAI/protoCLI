/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useIsScreenReaderEnabled } from 'ink';
import { useUIState } from './contexts/UIStateContext.js';
import { useSettings } from './contexts/SettingsContext.js';
import { StreamingContext } from './contexts/StreamingContext.js';
import { QuittingDisplay } from './components/QuittingDisplay.js';
import { ScreenReaderAppLayout } from './layouts/ScreenReaderAppLayout.js';
import { DefaultAppLayout } from './layouts/DefaultAppLayout.js';
import { FullScreenAppLayout } from './layouts/FullScreenAppLayout.js';
import { useFullScreen } from './hooks/useFullScreen.js';

export const App = () => {
  const uiState = useUIState();
  const settings = useSettings();
  const isScreenReaderEnabled = useIsScreenReaderEnabled();
  // Full-screen is on when the setting or the PROTO_FULLSCREEN env escape hatch
  // asks for it — but screen-reader mode always wins (plain inline layout), so
  // the alt-screen never engages for assistive-tech users.
  const fullScreenEnabled =
    ((settings.merged.ui?.fullScreen ?? false) ||
      process.env['PROTO_FULLSCREEN'] === '1') &&
    !isScreenReaderEnabled;
  const fullScreen = useFullScreen(fullScreenEnabled);

  if (uiState.quittingMessages) {
    return <QuittingDisplay />;
  }

  return (
    <StreamingContext.Provider value={uiState.streamingState}>
      {isScreenReaderEnabled ? (
        <ScreenReaderAppLayout />
      ) : fullScreen ? (
        <FullScreenAppLayout />
      ) : (
        <DefaultAppLayout />
      )}
    </StreamingContext.Provider>
  );
};
