import { BatchTask } from '../../models/BatchTask';

/**
 * SSE 回调适配器
 * 将 SSE 事件转换为 MongoDB 更新操作
 * 这样可以复用现有的 generate-script-enhanced 路由而无需大规模重构
 */
export class SSECallbackAdapter {
    private taskId: string;
    private episodeNumber: number;
    private cancelled = false;
    private onLog?: (log: { time: Date; message: string; level: 'info' | 'warn' | 'error'; episode: number }) => void;

    constructor(
        taskId: string,
        episodeNumber: number,
        onLog?: (log: { time: Date; message: string; level: 'info' | 'warn' | 'error'; episode: number }) => void
    ) {
        this.taskId = taskId;
        this.episodeNumber = episodeNumber;
        this.onLog = onLog;
    }

    /**
     * 发送进度更新
     */
    async sendProgress(current: number, total: number, status: string) {
        try {
            await BatchTask.findByIdAndUpdate(this.taskId, {
                'currentProgress.percent': (current / total) * 100,
                'currentProgress.step': status.substring(0, 100),  // 限制长度防止过大
                'currentProgress.message': status,
                'currentProgress.startTime': new Date(),
                updatedAt: new Date()
            });
        } catch (error) {
            console.error(`[SSEAdapter] Failed to update progress:`, error);
        }
    }

    /**
     * 发送日志消息
     */
    async sendLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
        try {
            const logEntry = {
                time: new Date(),
                message: message.substring(0, 500),  // 限制长度
                level,
                episode: this.episodeNumber
            } as any;

            const updateLog = () =>
                BatchTask.findByIdAndUpdate(
                    this.taskId,
                    {
                        $push: {
                            logs: {
                                $each: [logEntry],
                                $slice: -200
                            }
                        },
                        $set: { updatedAt: new Date() }
                    },
                    { new: false }
                );

            let updated = await updateLog();

            if (!updated) {
                console.warn(`[SSEAdapter] Task ${this.taskId} not found for logging`);
                return;
            }

            console.log(`[SSEAdapter] Log saved for task ${this.taskId}, episode ${this.episodeNumber}: ${message.substring(0, 50)}`);
            if (this.onLog) {
                try {
                    this.onLog(logEntry);
                } catch (error) {
                    console.error('[SSEAdapter] Failed to broadcast log:', error);
                }
            }
        } catch (error) {
            try {
                await new Promise(resolve => setTimeout(resolve, 80));
                const retryLogEntry = {
                    time: new Date(),
                    message: message.substring(0, 500),
                    level,
                    episode: this.episodeNumber
                } as any;
                const updated = await BatchTask.findByIdAndUpdate(
                    this.taskId,
                    {
                        $push: {
                            logs: {
                                $each: [retryLogEntry],
                                $slice: -200
                            }
                        },
                        $set: { updatedAt: new Date() }
                    },
                    { new: false }
                );
                if (!updated) {
                    console.warn(`[SSEAdapter] Task ${this.taskId} not found for logging`);
                    return;
                }
                if (this.onLog) {
                    try {
                        this.onLog(retryLogEntry);
                    } catch (retryBroadcastError) {
                        console.error('[SSEAdapter] Failed to broadcast log after retry:', retryBroadcastError);
                    }
                }
            } catch (retryError) {
                console.error(`[SSEAdapter] Failed to add log after retry:`, retryError);
            }
        }
    }

    /**
     * 发送上下文信息
     */
    async sendContext(data: any) {
        try {
            const { type, ...contextData } = data;
            await BatchTask.findByIdAndUpdate(this.taskId, {
                lastContext: contextData,
                updatedAt: new Date()
            });
            // 自动记录日志
            const charCount = contextData.relevantCharacters?.length || 0;
            const foreCount = contextData.relevantForeshadowings?.length || 0;
            await this.sendLog(
                `📋 上下文加载完成：${charCount}个角色，${foreCount}条伏笔`,
                'info'
            );
        } catch (error) {
            console.error(`[SSEAdapter] Failed to update context:`, error);
        }
    }

    /**
     * 发送分析结果
     */
    async sendAnalysis(data: any) {
        try {
            const { type, ...analysisData } = data;
            await BatchTask.findByIdAndUpdate(this.taskId, {
                lastAnalysis: analysisData,
                updatedAt: new Date()
            });
            // 自动记录日志
            const newChars = analysisData.newCharacters?.length || 0;
            const planted = analysisData.foreshadowingPlanted?.length || 0;
            await this.sendLog(
                `🔍 分析完成：新增${newChars}个角色，种下${planted}条伏笔`,
                'info'
            );
        } catch (error) {
            console.error(`[SSEAdapter] Failed to update analysis:`, error);
        }
    }

    /**
     * 发送多头注意力分析
     */
    async sendMultiHeadAnalysis(data: any) {
        try {
            const { type, ...analysisData } = data;
            await BatchTask.findByIdAndUpdate(this.taskId, {
                lastMultiHeadAnalysis: analysisData,
                updatedAt: new Date()
            });
            // 自动记录日志
            const headCount = analysisData.enabledHeads?.length || 0;
            await this.sendLog(
                `🎯 多头分析完成：启用${headCount}个注意力头`,
                'info'
            );
        } catch (error) {
            console.error(`[SSEAdapter] Failed to update multiHeadAnalysis:`, error);
        }
    }

    /**
     * 发送角色生命周期变化
     */
    async sendCharacterLifecycle(data: any) {
        // 暂时不保存，因为前端不展示
        // 如需要可保存到 lastCharacterLifecycle
    }

    /**
     * 发送约束验证结果
     */
    async sendConstraintValidation(data: any) {
        try {
            const { type, ...validationData } = data;
            await BatchTask.findByIdAndUpdate(this.taskId, {
                lastConstraintValidation: validationData,
                updatedAt: new Date()
            });
            // 自动记录日志
            const rate = Math.round((validationData.satisfactionRate || 0) * 100);
            const passed = validationData.overallSatisfied ? '✅' : '⚠️';
            await this.sendLog(
                `${passed} 约束验证：满足率${rate}%`,
                validationData.overallSatisfied ? 'info' : 'warn'
            );
        } catch (error) {
            console.error(`[SSEAdapter] Failed to update constraintValidation:`, error);
        }
    }

    /**
     * 发送 AI 约束决策
     */
    async sendAIConstraintDecision(data: any) {
        try {
            const { type, ...decisionData } = data;
            await BatchTask.findByIdAndUpdate(this.taskId, {
                lastAIConstraintDecision: decisionData,
                updatedAt: new Date()
            });
            // 自动记录日志
            // 修复：当 decision 字段缺失时，默认为 'accept'（因为成功到达这里说明决策成功）
            const decision = decisionData.decision || 'accept';
            const emoji = decision === 'accept' ? '✅' : decision === 'retry' ? '🔄' : '❌';
            await this.sendLog(
                `${emoji} AI决策：${decision === 'accept' ? '完成' : decision === 'retry' ? '重试' : '拒绝'}`,
                decision === 'accept' ? 'info' : 'warn'
            );
        } catch (error) {
            console.error(`[SSEAdapter] Failed to update aiConstraintDecision:`, error);
        }
    }

    /**
     * 发送预算分配信息
     */
    async sendBudgetAllocation(data: any) {
        try {
            const { type, ...budgetData } = data;
            await BatchTask.findByIdAndUpdate(this.taskId, {
                lastBudgetAllocation: budgetData,
                updatedAt: new Date()
            });
            // 自动记录日志（简化版，避免过多细节）
            await this.sendLog(
                `💰 预算分配完成`,
                'info'
            );
        } catch (error) {
            console.error(`[SSEAdapter] Failed to update budgetAllocation:`, error);
        }
    }

    /**
     * 发送重试通知
     */
    async sendRetryNotification(data: any) {
        // 重试通知记录在日志中
        await this.sendLog(
            `🔄 重试通知：第${data.attemptNumber}次尝试（共${data.maxAttempts}次）- ${data.reason}`,
            'warn'
        );
    }

    /**
     * 发送生成文本块（流式输出）
     */
    async sendChunk(text: string) {
        // 批量模式不需要实时流式输出，跳过
        // 最终内容会通过 Episode 模型获取
    }

    /**
     * 发送完成消息
     */
    async sendDone(data?: any) {
        await this.sendLog(`✅ 第${this.episodeNumber}集生成完成`, 'info');
    }

    /**
     * 发送错误消息
     */
    async sendError(message: string) {
        await this.sendLog(`❌ 错误: ${message}`, 'error');
    }

    /**
     * 检查任务是否被取消
     */
    async isClosed(): Promise<boolean> {
        if (this.cancelled) return true;

        try {
            const task = await BatchTask.findById(this.taskId);
            return task?.status === 'stopped';
        } catch (error) {
            console.error(`[SSEAdapter] Failed to check task status:`, error);
            return false;
        }
    }

    /**
     * 取消任务
     */
    cancel() {
        this.cancelled = true;
    }

    /**
     * 设置连接关闭回调（兼容 SSEHandler 接口）
     */
    onClose(callback: () => void) {
        // 批量模式不需要连接关闭回调
        // 因为是通过 HTTP 请求而非长连接
    }
}
