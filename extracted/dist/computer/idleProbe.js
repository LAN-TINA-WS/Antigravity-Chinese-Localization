"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdleHelperProbe = void 0;
class IdleHelperProbe {
    constructor(deps) {
        this.deps = deps;
        this.failing = false;
    }
    /** The surface info; see the fileoverview. */
    probe() {
        if (this.inFlight) {
            return this.inFlight;
        }
        // A synchronous throw (e.g. no helper path) is a failed probe too.
        const p = Promise.resolve()
            .then(() => this.deps.probeOnce())
            .then((r) => {
            this.failing = false;
            return { ...r, grants: this.hubGrants() };
        })
            .catch((err) => {
            if (!this.failing) {
                this.failing = true;
                (this.deps.warn ?? console.warn)('[ComputerUse] helper probe failed; reporting the Hub grants:', err);
            }
            return this.deps.fallback();
        })
            .finally(() => {
            this.inFlight = undefined;
        });
        this.inFlight = p;
        return p;
    }
    /** The Hub's grants; an unreadable one reads as not granted. */
    hubGrants() {
        try {
            const g = this.deps.hubGrants();
            return {
                accessibility: g.accessibility === true,
                screen_recording: g.screen_recording === true,
            };
        }
        catch (_e) {
            return { accessibility: false, screen_recording: false };
        }
    }
}
exports.IdleHelperProbe = IdleHelperProbe;
