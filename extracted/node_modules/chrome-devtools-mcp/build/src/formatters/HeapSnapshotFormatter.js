/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { DevTools } from '../third_party/index.js';
import { stableIdSymbol } from '../utils/id.js';
const { formatBytesToKb } = DevTools.I18n.ByteUtilities;
export function isNodeLike(item) {
    return (typeof item === 'object' && item !== null && 'id' in item && 'name' in item);
}
export function isEdgeLike(item) {
    return (typeof item === 'object' &&
        item !== null &&
        'name' in item &&
        'node' in item &&
        'type' in item &&
        typeof item.node === 'object' &&
        item.node !== null &&
        'id' in item.node &&
        'name' in item.node);
}
export class HeapSnapshotFormatter {
    #aggregates;
    constructor(aggregates) {
        this.#aggregates = aggregates;
    }
    static formatNodes(items) {
        const lines = [];
        if (items.length > 0) {
            const firstItem = items[0];
            if (isNodeLike(firstItem)) {
                lines.push('nodeId,nodeName,type,distance,selfSize,retainedSize');
            }
            else if (isEdgeLike(firstItem)) {
                lines.push('name,type,nodeId,nodeName,selfSize,retainedSize');
            }
        }
        for (const item of items) {
            if (isNodeLike(item)) {
                lines.push(`${item.id},${item.name},${item.type},${item.distance},${formatBytesToKb(item.selfSize)},${formatBytesToKb(item.retainedSize)}`);
            }
            else if (isEdgeLike(item)) {
                lines.push(`${item.name},${item.type},${item.node.id},${item.node.name},${formatBytesToKb(item.node.selfSize)},${formatBytesToKb(item.node.retainedSize)}`);
            }
        }
        return lines.join('\n');
    }
    static formatRetainingPaths(retainingPaths) {
        const lines = [];
        function formatEdge(edge, depth) {
            const indent = '  '.repeat(depth);
            lines.push(`${indent}<- @${edge.nodeId} ${edge.nodeName} via ${edge.edgeType} ${edge.edgeName} (distance: ${edge.distance})`);
            for (const child of edge.children) {
                formatEdge(child, depth + 1);
            }
        }
        for (const path of retainingPaths) {
            formatEdge(path, 0);
        }
        return lines.join('\n');
    }
    static formatDominators(dominators) {
        const lines = [];
        lines.push('nodeId,nodeName,selfSize,retainedSize');
        for (const node of dominators) {
            lines.push(`${node.nodeId},${node.nodeName},${formatBytesToKb(node.selfSize)},${formatBytesToKb(node.retainedSize)}`);
        }
        return lines.join('\n');
    }
    static formatDuplicateStrings(groups) {
        const lines = [];
        lines.push('value,count,totalSelfSize,totalRetainedSize,truncated,nodeIds');
        for (const group of groups) {
            const nodeIds = group.nodes.map(n => `@${n.id}`).join(' ');
            const truncated = group.truncated ?? false;
            lines.push(`${JSON.stringify(group.value)},${group.count},${formatBytesToKb(group.totalSelfSize)},${formatBytesToKb(group.totalRetainedSize)},${truncated},${nodeIds}`);
        }
        return lines.join('\n');
    }
    static formatNativeContextSizes(sizes) {
        const lines = [];
        lines.push('nodeId,nodeName,selfSize,retainedSize,attributedSize');
        const sortedContexts = [...sizes.nativeContexts].sort((a, b) => b.attributedSize - a.attributedSize);
        for (const nc of sortedContexts) {
            lines.push(`${nc.nodeId},${nc.nodeName},${formatBytesToKb(nc.selfSize)},${formatBytesToKb(nc.retainedSize)},${formatBytesToKb(nc.attributedSize)}`);
        }
        lines.push(`Shared Size: ${formatBytesToKb(sizes.sharedSize)}`);
        lines.push(`Unattributed Size: ${formatBytesToKb(sizes.noAttributionSize)}`);
        return lines.join('\n');
    }
    static formatRetainedByContextSummary(summary) {
        const lines = [];
        lines.push(`Context count: ${summary.contextCount}`);
        lines.push(`Retained by context size: ${formatBytesToKb(summary.retainedByContextSize)} (${summary.retainedByContextCount} objects)`);
        lines.push(`Not retained by context size: ${formatBytesToKb(summary.notRetainedByContextSize)} (${summary.notRetainedByContextCount} objects)`);
        lines.push(`Total size: ${formatBytesToKb(summary.totalSize)}`);
        return lines.join('\n');
    }
    #getSortedAggregates() {
        return Object.values(this.#aggregates).sort((a, b) => b.maxRet - a.maxRet);
    }
    toString() {
        const sorted = this.#getSortedAggregates();
        const lines = [];
        lines.push('id,name,count,selfSize,retainedSize');
        for (const info of sorted) {
            const id = info[stableIdSymbol] ?? '';
            lines.push(`${id},${info.name},${info.count},${formatBytesToKb(info.self)},${formatBytesToKb(info.maxRet)}`);
        }
        return lines.join('\n');
    }
    toJSON() {
        const sorted = this.#getSortedAggregates();
        return sorted.map(info => ({
            id: info[stableIdSymbol],
            className: info.name,
            count: info.count,
            selfSize: formatBytesToKb(info.self),
            retainedSize: formatBytesToKb(info.maxRet),
        }));
    }
    static sort(aggregates) {
        return Object.entries(aggregates).sort((a, b) => b[1].maxRet - a[1].maxRet);
    }
    static formatDiffSummary(diffs) {
        const lines = [];
        lines.push('index,className,addedCount,removedCount,countDelta,addedSize,removedSize,sizeDelta');
        let index = 0;
        for (const diff of diffs) {
            lines.push(`${index},${diff.className},${diff.addedCount},${diff.removedCount},${diff.countDelta},${formatBytesToKb(diff.addedSize)},${formatBytesToKb(diff.removedSize)},${formatBytesToKb(diff.sizeDelta)}`);
            index++;
        }
        return lines.join('\n');
    }
    static formatDiffDetails(diff) {
        const lines = [];
        lines.push(`${diff.className}: # new: ${diff.addedCount}, # deleted: ${diff.removedCount}, # delta: ${formatSignedCount(diff.countDelta)}, alloc size: ${formatSignedSize(diff.addedSize)}, freed size: ${formatSignedSize(diff.removedSize)}, size delta: ${formatSignedSize(diff.sizeDelta)}`);
        const addedIds = diff.addedIds;
        const addedSelfSizes = diff.addedSelfSizes;
        const deletedIds = diff.deletedIds;
        const deletedSelfSizes = diff.deletedSelfSizes;
        lines.push(`Objects:`);
        for (let i = 0; i < addedIds.length; i++) {
            lines.push(`  + @${addedIds[i]} (self_size: ${formatBytesToKb(addedSelfSizes[i])})`);
        }
        for (let i = 0; i < deletedIds.length; i++) {
            lines.push(`  - @${deletedIds[i]} (self_size: ${formatBytesToKb(deletedSelfSizes[i])})`);
        }
        return lines.join('\n');
    }
    static formatObjectInfo(info) {
        const lines = [
            `id: @${info.id}`,
            `name: ${info.name}`,
            `type: ${info.type}`,
            `detachedness: ${formatDOMLinkState(info.detachedness)}`,
            `selfSize: ${formatBytesToKb(info.selfSize)}`,
            `retainedSize: ${formatBytesToKb(info.retainedSize)}`,
            `distance: ${info.distance}`,
            `edgeCount: ${info.edgeCount}`,
            `retainerCount: ${info.retainerCount}`,
        ];
        return lines.join('\n');
    }
}
function formatDOMLinkState(state) {
    switch (state) {
        case 1 /* DevTools.HeapSnapshotModel.HeapSnapshotModel.DOMLinkState.ATTACHED */:
            return 'attached';
        case 2 /* DevTools.HeapSnapshotModel.HeapSnapshotModel.DOMLinkState.DETACHED */:
            return 'detached';
        case 0 /* DevTools.HeapSnapshotModel.HeapSnapshotModel.DOMLinkState.UNKNOWN */:
        default:
            return 'unknown';
    }
}
function formatSignedCount(n) {
    return n > 0 ? `+${n}` : `${n}`;
}
function formatSignedSize(bytes) {
    const formatted = formatBytesToKb(bytes);
    return bytes > 0 ? `+${formatted}` : formatted;
}
//# sourceMappingURL=HeapSnapshotFormatter.js.map