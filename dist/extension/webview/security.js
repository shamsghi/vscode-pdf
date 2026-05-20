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
exports.createNonce = createNonce;
exports.sanitizeUiText = sanitizeUiText;
exports.buildContentSecurityPolicy = buildContentSecurityPolicy;
exports.escapeAttribute = escapeAttribute;
const crypto = __importStar(require("node:crypto"));
function createNonce() {
    return crypto.randomBytes(16).toString("base64url");
}
function sanitizeUiText(value, fallback = "") {
    if (typeof value !== "string") {
        return fallback;
    }
    return value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 1000);
}
function buildContentSecurityPolicy(webview) {
    const source = webview.cspSource;
    return [
        "default-src 'none'",
        `img-src ${source} data:`,
        `font-src ${source}`,
        `style-src ${source}`,
        `script-src ${source}`,
        `connect-src ${source}`,
        "worker-src blob:",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'"
    ].join("; ");
}
function escapeAttribute(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
//# sourceMappingURL=security.js.map