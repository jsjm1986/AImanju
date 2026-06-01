/**
 * 一键部署脚本 - 清理缓存并重新编译
 * 
 * 使用方法：
 *   node deploy.js         # 清理缓存 + 编译前后端
 *   node deploy.js clean   # 仅清理缓存
 *   node deploy.js build   # 仅编译（不清理）
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
};

const log = {
    info: (msg) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
};

const ROOT_DIR = __dirname;
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');

// 需要清理的缓存目录
const CACHE_DIRS = [
    // 前端缓存
    path.join(FRONTEND_DIR, 'dist'),
    path.join(FRONTEND_DIR, 'node_modules', '.vite'),
    path.join(FRONTEND_DIR, 'node_modules', '.cache'),
    path.join(FRONTEND_DIR, '.tsbuildinfo'),
    // 后端缓存
    path.join(BACKEND_DIR, 'dist'),
    path.join(BACKEND_DIR, 'node_modules', '.cache'),
];

// 需要清理的临时文件模式
const TEMP_FILE_PATTERNS = [
    /^tmpclaude.*$/,
    /\.tsbuildinfo$/,
];

/**
 * 删除目录或文件
 */
function removeDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        try {
            fs.rmSync(dirPath, { recursive: true, force: true });
            log.success(`已删除: ${path.relative(ROOT_DIR, dirPath)}`);
            return true;
        } catch (e) {
            log.warn(`无法删除: ${path.relative(ROOT_DIR, dirPath)} - ${e.message}`);
            return false;
        }
    }
    return false;
}

/**
 * 清理临时文件
 */
function cleanTempFiles(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
        for (const pattern of TEMP_FILE_PATTERNS) {
            if (pattern.test(file)) {
                const filePath = path.join(dir, file);
                try {
                    fs.rmSync(filePath, { recursive: true, force: true });
                    log.success(`已删除临时文件: ${file}`);
                } catch (e) {
                    log.warn(`无法删除: ${file}`);
                }
            }
        }
    }
}

/**
 * 清理缓存
 */
function cleanCache() {
    log.info('开始清理缓存...\n');

    let cleaned = 0;

    // 清理缓存目录
    for (const dir of CACHE_DIRS) {
        if (removeDir(dir)) cleaned++;
    }

    // 清理临时文件
    cleanTempFiles(FRONTEND_DIR);
    cleanTempFiles(BACKEND_DIR);

    log.info(`\n缓存清理完成，共清理 ${cleaned} 个目录\n`);
}

/**
 * 执行命令
 */
function runCommand(cmd, cwd, description) {
    log.info(`${description}...`);
    try {
        execSync(cmd, {
            cwd,
            stdio: 'inherit',
            shell: true
        });
        log.success(`${description} 完成\n`);
        return true;
    } catch (e) {
        log.error(`${description} 失败`);
        return false;
    }
}

/**
 * 编译前端
 */
function buildFrontend() {
    log.info('========== 编译前端 ==========\n');

    // 检查 node_modules
    if (!fs.existsSync(path.join(FRONTEND_DIR, 'node_modules'))) {
        log.info('未找到 node_modules，正在安装依赖...');
        if (!runCommand('npm install', FRONTEND_DIR, '安装前端依赖')) {
            return false;
        }
    }

    return runCommand('npm run build', FRONTEND_DIR, '编译前端');
}

/**
 * 编译后端
 */
function buildBackend() {
    log.info('========== 编译后端 ==========\n');

    // 检查 node_modules
    if (!fs.existsSync(path.join(BACKEND_DIR, 'node_modules'))) {
        log.info('未找到 node_modules，正在安装依赖...');
        if (!runCommand('npm install', BACKEND_DIR, '安装后端依赖')) {
            return false;
        }
    }

    return runCommand('npm run build', BACKEND_DIR, '编译后端');
}

/**
 * 主函数
 */
function main() {
    const args = process.argv.slice(2);
    const mode = args[0] || 'all';

    console.log('\n=========================================');
    console.log('       动漫剧本系统 - 一键部署脚本');
    console.log('=========================================\n');

    const startTime = Date.now();
    let success = true;

    switch (mode) {
        case 'clean':
            cleanCache();
            break;

        case 'build':
            success = buildFrontend() && buildBackend();
            break;

        case 'all':
        default:
            cleanCache();
            success = buildFrontend() && buildBackend();
            break;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n=========================================');
    if (success) {
        log.success(`部署完成！耗时 ${elapsed} 秒`);
    } else {
        log.error(`部署过程中有错误，请检查上方日志`);
    }
    console.log('=========================================\n');

    process.exit(success ? 0 : 1);
}

main();
