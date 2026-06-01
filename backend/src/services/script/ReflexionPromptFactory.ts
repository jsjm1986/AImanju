import { ValidationResponse, ConstraintValidationResult } from '../constraint/ConstraintValidator';

export class ReflexionPromptFactory {
    /**
     * Constructs a reflexion prompt based on the validation response.
     * This prompt instructs the AI to rewrite the script to address the specific violations.
     */
    static createReflexionPrompt(
        originalPrompt: string,
        validation: ValidationResponse,
        attempt: number
    ): string {
        const criticalViolations = validation.results.filter(
            (r) => !r.fulfilled && r.severity === 'critical'
        );
        const importantViolations = validation.results.filter(
            (r) => !r.fulfilled && r.severity === 'important'
        );
        const normalViolations = validation.results.filter(
            (r) => !r.fulfilled && r.severity === 'normal'
        );

        let feedback = `上一版剧本未通过质量验证（满意度: ${(validation.satisfactionRate * 100).toFixed(1)}%）。\n`;
        feedback += `请根据以下验证报告进行重写：\n\n`;

        if (criticalViolations.length > 0) {
            feedback += `【必须修正的关键问题】(Critical)\n`;
            criticalViolations.forEach((v, i) => {
                feedback += `${i + 1}. ${v.constraintContent}\n`;
                if (v.reasoning) feedback += `   - 问题分析: ${v.reasoning}\n`;
                if (v.suggestions && v.suggestions.length > 0) {
                    feedback += `   - 修正建议: ${v.suggestions.join('；')}\n`;
                }
            });
            feedback += '\n';
        }

        if (importantViolations.length > 0) {
            feedback += `【重要问题】(Important)\n`;
            importantViolations.forEach((v, i) => {
                feedback += `${i + 1}. ${v.constraintContent}\n`;
                if (v.suggestions && v.suggestions.length > 0) {
                    feedback += `   - 修正建议: ${v.suggestions.join('；')}\n`;
                }
            });
            feedback += '\n';
        }

        if (normalViolations.length > 0 && attempt === 0) {
            // Only include normal violations in the first retry to avoid overwhelming the context
            feedback += `【优化建议】\n`;
            normalViolations.forEach((v, i) => {
                feedback += `- ${v.constraintContent}\n`;
            });
            feedback += '\n';
        }

        feedback += `重写要求：\n`;
        feedback += `1. **必须**优先解决所有【关键问题】和【重要问题】。\n`;
        feedback += `2. 保留原剧本中通过验证的优秀部分（如符合人设的对话、精彩的动作描写）。\n`;
        feedback += `3. 针对“Boss/反派”相关的约束，请必须描写具体的**资源调动**（如安保、资金、情报网），而不仅仅是口头命令。\n`;
        feedback += `4. 针对“伏笔/悬念”相关的约束，请给出明确的**指向性线索**，推进剧情进度。\n`;

        // Combine with original prompt?
        // Usually we append this to the user prompt or as a new turn.
        // Here we return just the feedback string to be appended.
        return feedback;
    }
}
