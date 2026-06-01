import { Response } from 'express';

interface RhythmItemDecision {
  needed: boolean;
  urgency: string;
  reason: string;
  subject?: string;
  object?: string;
  methodology?: string[];
  validationCriteria?: string[];
}

export class SSEHandler {
  private res: Response;
  private closed = false;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(res: Response) {
    this.res = res;
    this.setupHeaders();
    this.startHeartbeat();
  }

  private setupHeaders() {
    this.res.setHeader('Content-Type', 'text/event-stream');
    this.res.setHeader('Cache-Control', 'no-cache');
    this.res.setHeader('Connection', 'keep-alive');
    this.res.setHeader('X-Accel-Buffering', 'no');
    this.res.flushHeaders();
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (!this.closed) {
        this.res.write(': heartbeat\n\n');
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }

  send(event: string, data: unknown) {
    if (this.closed) return;
    const payload = typeof data === 'object' && data !== null
      ? { type: event, ...data as object }
      : { type: event, data };
    this.res.write(`event: ${event}\n`);
    this.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  sendChunk(content: string) {
    this.send('chunk', { content });
  }

  sendProgress(current: number, total: number, status: string) {
    this.send('progress', { current, total, status });
  }

  sendError(message: string) {
    this.send('error', { message });
    this.close();
  }

  sendLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    this.send('log', { message, level, timestamp: Date.now() });
  }

  sendContext(context: {
    originalEpisodePlan?: string;
    episodePlan?: string;
    episodePlanEnhanced?: boolean;
    constraints: string[];
    suggestions: string[];
    relevantCharacters: Array<{
      name: string;
      role: string;
      tier: string;
      weight: number;
      reason: string;
      equipment?: string[];
      abilities?: string[];
      physicalCondition?: string;
      mentalCondition?: string;
      combatPower?: string;
      location?: string;
      permanentMarks?: string[];
      relationships?: Record<string, string>;
    }>;
    relevantForeshadowings: Array<{
      content: string;
      weight: number;
      reason: string;
      episodePlanted?: number;
      importance?: string;
    }>;
    relevantEvents?: Array<{
      episode: number;
      content: string;
      weight?: number;
      reason?: string;
    }>;
    hiddenConnections: string[];
    plotState?: {
      currentArc: string;
      arcProgress: number;
      mainPlotProgress?: string;
      pendingConflicts: string[];
      recentEvents: Array<{ episode: number; event: string }>;
    };
    worldSettings?: {
      revealedSecrets: string[];
      factions: Array<{ name: string; status: string; attitude: string }>;
      locations: Array<{ name: string; description: string }>;
      items: Array<{ name: string; owner: string; status: string }>;
    };
    rhythmSettings?: {
      preset: string;
      coolPointDensity: number;
      plotTwistInterval: number;
      faceSlapInterval: number;
    };
    writingStyle?: {
      preset: string;
      presetName: string;
      customDescription?: string;
    };
    previousCliffhanger?: string | null;
    formattedContext?: string;
  }) {
    this.send('context', context);
  }

  sendAnalysis(analysis: {
    characterUpdates: number;
    newCharacters: Array<{ name: string; tier: string; role?: string }>;
    foreshadowingResolved: number;
    foreshadowingPlanted: Array<{ content: string; type: string; importance?: string }>;
    plotUpdates?: {
      currentArc: string;
      arcProgress: number;
      keyEvent: string;
      newConflict: string | null;
      resolvedConflict: string | null;
      cliffhanger: string;
    };
    worldUpdates?: {
      newSecrets: string[];
      factionChanges: Array<{ faction: string; change: string }>;
      newLocations: Array<{ name: string; description: string }>;
      itemChanges: Array<{ item: string; change: string }>;
    };
    episodeSummary?: {
      summary: string;
      keyEvents: string[];
      cliffhanger: string;
    };
    nextEpisodeHints?: {
      suggestedFocus: string[];
      pendingForeshadowings: string[];
      charactersThatShouldAppear: string[];
    };
    characterExits?: Array<{
      name: string;
      exitType: 'deceased' | 'departed' | 'archived';
      note: string;
    }>;
  }) {
    this.send('analysis', analysis);
  }

  sendMultiHeadAnalysis(result: {
    enabledHeads: string[];
    headResults: Array<{
      headType: string;
      insights: string[];
      suggestions: string[];
      constraints: string[];
      warnings: string[];
    }>;
    crossDimensionInsights: string[];
    aggregatedConstraints: string[];
    aggregatedSuggestions: string[];
  }) {
    this.send('multiHeadAnalysis', result);
  }

  sendCharacterLifecycle(lifecycle: {
    tierChanges: Array<{
      name: string;
      from: string;
      to: string;
      reason: string;
    }>;
    newCharactersToTrack: Array<{
      name: string;
      tier: string;
    }>;
    archivedCharacters: string[];
  }) {
    this.send('characterLifecycle', lifecycle);
  }

  sendConstraintValidation(validation: {
    overallSatisfied: boolean;
    satisfactionRate: number;
    criticalViolations: number;
    importantViolations: number;
    normalViolations: number;
    results: Array<{
      constraintId: string;
      constraintType: string;
      constraintContent: string;
      fulfilled: boolean;
      confidence: number;
      evidence: string | null;
      reasoning: string;
      severity: string;
      suggestions?: string[];
    }>;
    summary: string;
    improvementSuggestions: string[];
    retryInfo?: {
      attemptNumber: number;
      maxAttempts: number;
      reason: string;
    };
  }) {
    this.send('constraintValidation', validation);
  }

  sendAIConstraintDecision(decision: {
    rhythm: {
      faceSlap: RhythmItemDecision;
      plotTwist: RhythmItemDecision;
      boss: RhythmItemDecision;
      guidanceNotes?: string[];
    };
    foreshadowing: {
      mustResolveCount: number;
      canResolveCount: number;
      shouldIgnoreCount: number;
      mustResolve: Array<{
        id: string;
        content: string;
        reason: string;
        urgency: string;
        episodePlanted?: number;
        originalHint?: string;
        methodology?: string[];
        validationCriteria?: string[];
      }>;
      canResolve?: Array<{ content: string; reason: string }>;
      shouldIgnore?: Array<{ content: string; reason: string }>;
    };
    cliffhanger: {
      mustContinue: boolean;
      content: string | null;
      reason: string;
    };
    characterStatesCount: number;
    characterStates?: Array<{ name: string; condition: string; mustShow: boolean; reason: string }>;
    worldConsistencyCount: number;
    worldConsistency?: Array<{ content: string; severity: string; reason: string }>;
    summary: string;
    stats: {
      totalConstraints: number;
      verifiableCount: number;
      guidanceCount: number;
      criticalCount: number;
      importantCount: number;
    };
  }) {
    this.send('aiConstraintDecision', decision);
  }

  sendRetryNotification(info: {
    attemptNumber: number;
    maxAttempts: number;
    reason: string;
    strengthenedConstraints: string[];
  }) {
    this.send('retryNotification', info);
  }

  sendDone(data?: unknown) {
    this.send('done', data || { success: true });
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.stopHeartbeat();
    this.res.end();
  }

  isClosed() {
    return this.closed;
  }

  onClose(callback: () => void) {
    this.res.on('close', () => {
      this.closed = true;
      this.stopHeartbeat();
      callback();
    });
  }
}
