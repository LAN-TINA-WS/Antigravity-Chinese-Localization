"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const wsl_1 = require("./wsl");
const SAMPLE_LIST = [
    '  NAME              STATE           VERSION',
    '* Ubuntu            Running         2',
    '  Debian            Stopped         2',
    '  docker-desktop    Running         2',
    '  rancher-desktop   Stopped         2',
    '  podman-machine    Stopped         2',
    '  LegacyDistro      Stopped         1',
    '',
].join('\r\n');
(0, vitest_1.describe)('parseWslListOutput', () => {
    (0, vitest_1.it)('parses names, states, versions and the default marker', () => {
        const distros = (0, wsl_1.parseWslListOutput)(SAMPLE_LIST);
        (0, vitest_1.expect)(distros).toHaveLength(6);
        (0, vitest_1.expect)(distros[0]).toEqual({
            name: 'Ubuntu',
            version: 2,
            isDefault: true,
        });
        (0, vitest_1.expect)(distros[1].isDefault).toBe(false);
        (0, vitest_1.expect)(distros[5].version).toBe(1);
    });
    (0, vitest_1.it)('returns empty on garbage output', () => {
        (0, vitest_1.expect)((0, wsl_1.parseWslListOutput)('')).toEqual([]);
        (0, vitest_1.expect)((0, wsl_1.parseWslListOutput)('no distros installed')).toEqual([]);
    });
});
(0, vitest_1.describe)('isSupportedDevDistro', () => {
    (0, vitest_1.it)('keeps WSL 2 user distros and drops container runtimes and WSL 1', () => {
        const supported = (0, wsl_1.parseWslListOutput)(SAMPLE_LIST).filter(wsl_1.isSupportedDevDistro);
        (0, vitest_1.expect)(supported.map((d) => d.name)).toEqual(['Ubuntu', 'Debian']);
    });
});
(0, vitest_1.describe)('decodeWslOutput', () => {
    (0, vitest_1.it)('decodes UTF-16LE output from wsl.exe itself', () => {
        const buf = Buffer.from('* Ubuntu Running 2', 'utf16le');
        (0, vitest_1.expect)((0, wsl_1.decodeWslOutput)(buf)).toBe('* Ubuntu Running 2');
    });
    (0, vitest_1.it)('decodes UTF-8 output from Linux programs', () => {
        (0, vitest_1.expect)((0, wsl_1.decodeWslOutput)(Buffer.from('hello', 'utf8'))).toBe('hello');
    });
});
(0, vitest_1.describe)('buildInstallScript', () => {
    (0, vitest_1.it)('writes to a temp file, verifies the checksum, then renames', () => {
        const script = (0, wsl_1.buildInstallScript)('1.2.3', 'abc123');
        (0, vitest_1.expect)(script).toContain('$HOME/.antigravity-server/bin/1.2.3');
        (0, vitest_1.expect)(script).toContain('cat > "$tmp"');
        (0, vitest_1.expect)(script).toContain('sha256sum -c');
        (0, vitest_1.expect)(script).toContain('abc123');
        (0, vitest_1.expect)(script).toContain('mv -f "$tmp" "$dir/language_server"');
        // Interrupted installs must not leave partial files behind.
        (0, vitest_1.expect)(script).toContain(`trap 'rm -f "$tmp"' EXIT`);
    });
});
(0, vitest_1.describe)('wslShellArgs', () => {
    (0, vitest_1.it)('passes positional args after the script', () => {
        (0, vitest_1.expect)((0, wsl_1.wslShellArgs)('Ubuntu', 'exec "$1"', ['--flag'])).toEqual([
            '-d',
            'Ubuntu',
            '--exec',
            'sh',
            '-c',
            'exec "$1"',
            'sh',
            '--flag',
        ]);
    });
});
(0, vitest_1.describe)('serverBinaryPath', () => {
    (0, vitest_1.it)('is versioned under ~/.antigravity-server', () => {
        (0, vitest_1.expect)((0, wsl_1.serverBinaryPath)('2.12.3')).toBe('$HOME/.antigravity-server/bin/2.12.3/language_server');
    });
});
(0, vitest_1.describe)('windowsToDistroPath', () => {
    (0, vitest_1.it)('translates wsl.localhost UNC paths for the active distro', () => {
        (0, vitest_1.expect)((0, wsl_1.windowsToDistroPath)('\\\\wsl.localhost\\Ubuntu\\home\\user\\proj', 'Ubuntu')).toEqual({ path: '/home/user/proj' });
    });
    (0, vitest_1.it)('translates legacy wsl$ UNC paths', () => {
        (0, vitest_1.expect)((0, wsl_1.windowsToDistroPath)('\\\\wsl$\\Ubuntu\\home\\user', 'Ubuntu')).toEqual({ path: '/home/user' });
    });
    (0, vitest_1.it)('is case-insensitive on the distro name', () => {
        (0, vitest_1.expect)((0, wsl_1.windowsToDistroPath)('\\\\wsl.localhost\\ubuntu\\tmp', 'Ubuntu')).toEqual({ path: '/tmp' });
    });
    (0, vitest_1.it)('rejects paths from a different distro', () => {
        const t = (0, wsl_1.windowsToDistroPath)('\\\\wsl.localhost\\Debian\\home', 'Ubuntu');
        (0, vitest_1.expect)(t.path).toBeUndefined();
        (0, vitest_1.expect)(t.error).toContain('Debian');
        (0, vitest_1.expect)(t.error).toContain('Ubuntu');
    });
    (0, vitest_1.it)('maps drive letters to /mnt with a performance warning', () => {
        const t = (0, wsl_1.windowsToDistroPath)('C:\\Users\\me\\code', 'Ubuntu');
        (0, vitest_1.expect)(t.path).toBe('/mnt/c/Users/me/code');
        (0, vitest_1.expect)(t.warning).toContain('slow');
        (0, vitest_1.expect)(t.error).toBeUndefined();
    });
    (0, vitest_1.it)('handles the distro root and drive root', () => {
        (0, vitest_1.expect)((0, wsl_1.windowsToDistroPath)('\\\\wsl.localhost\\Ubuntu', 'Ubuntu').path).toBe('/');
        (0, vitest_1.expect)((0, wsl_1.windowsToDistroPath)('D:\\', 'Ubuntu').path).toBe('/mnt/d/');
    });
    (0, vitest_1.it)('passes through POSIX paths', () => {
        (0, vitest_1.expect)((0, wsl_1.windowsToDistroPath)('/home/user', 'Ubuntu')).toEqual({
            path: '/home/user',
        });
    });
    (0, vitest_1.it)('rejects other UNC and relative paths', () => {
        (0, vitest_1.expect)((0, wsl_1.windowsToDistroPath)('\\\\server\\share\\x', 'Ubuntu').error).toBeDefined();
        (0, vitest_1.expect)((0, wsl_1.windowsToDistroPath)('relative\\path', 'Ubuntu').error).toBeDefined();
    });
});
(0, vitest_1.describe)('distroToWindowsPath', () => {
    (0, vitest_1.it)('maps POSIX paths to the wsl.localhost UNC view', () => {
        (0, vitest_1.expect)((0, wsl_1.distroToWindowsPath)('/home/user/proj', 'Ubuntu')).toBe('\\\\wsl.localhost\\Ubuntu\\home\\user\\proj');
    });
});
(0, vitest_1.describe)('active distro state', () => {
    (0, vitest_1.it)('defaults to empty and round-trips', () => {
        (0, vitest_1.expect)((0, wsl_1.getActiveWslDistro)()).toBe('');
        (0, wsl_1.setActiveWslDistro)('Ubuntu');
        (0, vitest_1.expect)((0, wsl_1.getActiveWslDistro)()).toBe('Ubuntu');
        (0, wsl_1.setActiveWslDistro)('');
    });
});
(0, vitest_1.describe)('resolveStableArtifactDir', () => {
    (0, vitest_1.afterEach)(() => vitest_1.vi.unstubAllGlobals());
    (0, vitest_1.it)('maps a version to its <version>-<execution_id> release folder', async () => {
        const fetchMock = vitest_1.vi.fn(async () => ({
            ok: true,
            json: async () => [
                { version: '2.13.0', execution_id: '6362815968182272' },
                { version: '2.12.2', execution_id: '6298742303883264' },
            ],
        }));
        vitest_1.vi.stubGlobal('fetch', fetchMock);
        await (0, vitest_1.expect)((0, wsl_1.resolveStableArtifactDir)('2.12.2')).resolves.toBe(`${wsl_1.PUBLIC_ARTIFACT_BASE_URL}/antigravity-hub/2.12.2-6298742303883264`);
        (0, vitest_1.expect)(fetchMock).toHaveBeenCalledWith(`${wsl_1.DEFAULT_UPDATER_BASE_URL}/releases`);
    });
    (0, vitest_1.it)('rejects when the running version has no published release', async () => {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn(async () => ({ ok: true, json: async () => [] })));
        await (0, vitest_1.expect)((0, wsl_1.resolveStableArtifactDir)('9.9.9')).rejects.toThrow('9.9.9');
    });
});
(0, vitest_1.describe)('resolveInsidersArtifactDir', () => {
    (0, vitest_1.afterEach)(() => vitest_1.vi.unstubAllGlobals());
    (0, vitest_1.it)('reads the version from the latest-<arch>-linux.yml channel file', async () => {
        const yml = [
            'version: 1.0.20260911110044',
            'files:',
            '  - url: 1.0.20260911110044/Antigravity - Insiders-x86_64.AppImage',
            'path: 1.0.20260911110044/Antigravity - Insiders-x86_64.AppImage',
        ].join('\n');
        const fetchMock = vitest_1.vi.fn(async () => ({ ok: true, text: async () => yml }));
        vitest_1.vi.stubGlobal('fetch', fetchMock);
        await (0, vitest_1.expect)((0, wsl_1.resolveInsidersArtifactDir)('x64')).resolves.toBe(`${wsl_1.PUBLIC_ARTIFACT_BASE_URL}/insiders/1.0.20260911110044`);
        (0, vitest_1.expect)(fetchMock).toHaveBeenCalledWith(`${wsl_1.PUBLIC_ARTIFACT_BASE_URL}/insiders/latest-x64-linux.yml`);
    });
    (0, vitest_1.it)('rejects when the channel file has no version field', async () => {
        vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn(async () => ({ ok: true, text: async () => 'files:\n' })));
        await (0, vitest_1.expect)((0, wsl_1.resolveInsidersArtifactDir)('x64')).rejects.toThrow('No version');
    });
});
(0, vitest_1.describe)('resolveServerBinarySource', () => {
    (0, vitest_1.afterEach)(() => vitest_1.vi.unstubAllGlobals());
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    (0, vitest_1.it)('downloads the stable LS from its release folder under unsigned/', async () => {
        const fetchMock = vitest_1.vi.fn(async (url) => url === `${wsl_1.DEFAULT_UPDATER_BASE_URL}/releases`
            ? {
                ok: true,
                status: 200,
                json: async () => [{ version: '2.12.2', execution_id: '629' }],
            }
            : { ok: false, status: 404, json: async () => ({}) });
        vitest_1.vi.stubGlobal('fetch', fetchMock);
        await (0, vitest_1.expect)((0, wsl_1.resolveServerBinarySource)('2.12.2', false)).rejects.toThrow('HTTP 404');
        (0, vitest_1.expect)(fetchMock).toHaveBeenLastCalledWith(`${wsl_1.PUBLIC_ARTIFACT_BASE_URL}/antigravity-hub/2.12.2-629/unsigned/language_server-linux-${arch}`);
    });
    (0, vitest_1.it)('downloads the insiders LS from the folder named by the channel file', async () => {
        const fetchMock = vitest_1.vi.fn(async (url) => url === `${wsl_1.PUBLIC_ARTIFACT_BASE_URL}/insiders/latest-${arch}-linux.yml`
            ? { ok: true, status: 200, text: async () => 'version: 1.0.42\nfiles:' }
            : { ok: false, status: 404, text: async () => '' });
        vitest_1.vi.stubGlobal('fetch', fetchMock);
        await (0, vitest_1.expect)((0, wsl_1.resolveServerBinarySource)('1.0.42', true)).rejects.toThrow('HTTP 404');
        (0, vitest_1.expect)(fetchMock).toHaveBeenLastCalledWith(`${wsl_1.PUBLIC_ARTIFACT_BASE_URL}/insiders/1.0.42/unsigned/language_server-linux-${arch}`);
    });
});
(0, vitest_1.describe)('persistWslDistro / readPersistedWslDistro', () => {
    const stateFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wsl-state-')), 'wsl_state.json');
    (0, vitest_1.it)('round-trips a distro name', () => {
        const file = stateFile();
        (0, wsl_1.persistWslDistro)(file, 'Ubuntu');
        (0, vitest_1.expect)((0, wsl_1.readPersistedWslDistro)(file)).toBe('Ubuntu');
    });
    (0, vitest_1.it)('round-trips local mode (empty string)', () => {
        const file = stateFile();
        (0, wsl_1.persistWslDistro)(file, 'Ubuntu');
        (0, wsl_1.persistWslDistro)(file, '');
        (0, vitest_1.expect)((0, wsl_1.readPersistedWslDistro)(file)).toBe('');
    });
    (0, vitest_1.it)('returns "" when the state file is missing', () => {
        (0, vitest_1.expect)((0, wsl_1.readPersistedWslDistro)(stateFile())).toBe('');
    });
    (0, vitest_1.it)('returns "" for malformed or unexpected state contents', () => {
        const file = stateFile();
        fs.writeFileSync(file, 'not json');
        (0, vitest_1.expect)((0, wsl_1.readPersistedWslDistro)(file)).toBe('');
        fs.writeFileSync(file, JSON.stringify({ distro: 42 }));
        (0, vitest_1.expect)((0, wsl_1.readPersistedWslDistro)(file)).toBe('');
    });
    (0, vitest_1.it)('does not throw when the state file cannot be written', () => {
        const unwritable = path.join(os.tmpdir(), 'no-such-dir', 'deep', 'wsl_state.json');
        (0, vitest_1.expect)(() => (0, wsl_1.persistWslDistro)(unwritable, 'Ubuntu')).not.toThrow();
    });
});
