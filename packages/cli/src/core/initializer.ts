/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IdeClient,
  IdeConnectionEvent,
  IdeConnectionType,
  logIdeConnection,
  type Config,
  StartSessionEvent,
  logCliConfiguration,
  startupProfiler,
  coreEvents,
} from '@google/gemini-cli-core';
import { type LoadedSettings } from '../config/settings.js';
import { performInitialAuth } from './auth.js';
import { validateTheme } from './theme.js';
import type { TerminalBackgroundType } from '../ui/utils/terminalColorDetector.js';
import { themeManager } from '../ui/themes/theme-manager.js';

export interface InitializationResult {
  authError: string | null;
  themeError: string | null;
  shouldOpenAuthDialog: boolean;
  geminiMdFileCount: number;
}

/**
 * Orchestrates the application's startup initialization.
 * This runs BEFORE the React UI is rendered.
 * @param config The application config.
 * @param settings The loaded application settings.
 * @param detectedBackground The detected terminal background color.
 * @returns The results of the initialization.
 */
export async function initializeApp(
  config: Config,
  settings: LoadedSettings,
  detectedBackground: TerminalBackgroundType = 'unknown',
): Promise<InitializationResult> {
  const authHandle = startupProfiler.start('authenticate');
  const authError = await performInitialAuth(
    config,
    settings.merged.security?.auth?.selectedType,
  );
  authHandle?.end();
  const themeError = validateTheme(settings);

  if (detectedBackground !== 'unknown' && !themeError) {
    const currentTheme = themeManager.getActiveTheme();
    if (currentTheme.type !== 'ansi' && currentTheme.type !== 'custom') {
      if (currentTheme.type !== detectedBackground) {
        coreEvents.emitFeedback(
          'warning',
          `Theme '${currentTheme.name}' (${currentTheme.type}) might look incorrect on your ${detectedBackground} terminal background. Type /theme to change theme.`,
        );
      }
    }
  }

  const shouldOpenAuthDialog =
    settings.merged.security?.auth?.selectedType === undefined || !!authError;

  logCliConfiguration(
    config,
    new StartSessionEvent(config, config.getToolRegistry()),
  );

  if (config.getIdeMode()) {
    const ideClient = await IdeClient.getInstance();
    await ideClient.connect();
    logIdeConnection(config, new IdeConnectionEvent(IdeConnectionType.START));
  }

  return {
    authError,
    themeError,
    shouldOpenAuthDialog,
    geminiMdFileCount: config.getGeminiMdFileCount(),
  };
}
