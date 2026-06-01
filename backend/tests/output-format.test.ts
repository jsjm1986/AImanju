/**
 * OutputFormatService 单元测试
 */

import { outputFormatService } from '../src/services/format/OutputFormatService';
import { IOutputFormatConfig } from '../src/types/OutputFormat';

describe('OutputFormatService', () => {
    describe('resolveConfig', () => {
        it('should return standard preset by default', () => {
            const result = outputFormatService.resolveConfig(undefined);
            expect(result.sourcePreset).toBe('standard');
            expect(result.wordLimit.min).toBe(900);
        });

        it('should resolve preset mode correctly', () => {
            const config: IOutputFormatConfig = { mode: 'preset', preset: 'novel' };
            const result = outputFormatService.resolveConfig(config);
            expect(result.sourcePreset).toBe('novel');
            expect(result.wordLimit.min).toBe(1500);
        });

        it('should merge advanced overrides', () => {
            const config: IOutputFormatConfig = {
                mode: 'advanced',
                preset: 'standard',
                advanced: { wordLimit: { min: 800, target: 900, max: 1000, enforceStrict: true } }
            };
            const result = outputFormatService.resolveConfig(config);
            expect(result.wordLimit.min).toBe(800);
            expect(result.wordLimit.max).toBe(1000);
        });
    });

    describe('validateConfig', () => {
        it('should pass valid config', () => {
            const config: IOutputFormatConfig = { mode: 'preset', preset: 'standard' };
            const result = outputFormatService.validateConfig(config);
            expect(result.valid).toBe(true);
        });

        it('should fail when min > target', () => {
            const config: IOutputFormatConfig = {
                mode: 'advanced',
                preset: 'standard',
                advanced: { wordLimit: { min: 1000, target: 500, max: 1200, enforceStrict: true } }
            };
            const result = outputFormatService.validateConfig(config);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('最小字数不能大于目标字数');
        });
    });

    describe('buildFormatPromptSection', () => {
        it('should generate prompt section', () => {
            const resolved = outputFormatService.resolveConfig({ mode: 'preset', preset: 'standard' });
            const prompt = outputFormatService.buildFormatPromptSection(resolved);
            expect(prompt).toContain('## 输出格式');
            expect(prompt).toContain('## 创作规范');
            expect(prompt).toContain('900-1000字');
        });
    });

    describe('getPresets', () => {
        it('should return preset list', () => {
            const presets = outputFormatService.getPresets();
            expect(presets.length).toBeGreaterThan(0);
            expect(presets.find(p => p.id === 'standard')).toBeDefined();
        });
    });
});
