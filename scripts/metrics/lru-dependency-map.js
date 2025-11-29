#!/usr/bin/env node
/**
 * Learning Record Upload dependency mapper
 * Usage: node scripts/metrics/lru-dependency-map.js [relative-html-path]
 */
const fs = require('fs');
const path = require('path');

function readHtml(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`HTML file not found: ${resolved}`);
  }
  return { content: fs.readFileSync(resolved, 'utf8'), resolved };
}

function extractScripts(html) {
  const scriptTagRegex = /<script\s+([^>]*?)>([\s\S]*?)<\/script>/gi;
  const scripts = [];
  let match;
  let index = 1;
  while ((match = scriptTagRegex.exec(html)) !== null) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    const srcMatch = attrs.match(/src="([^"]+)"/i);
    const defer = /\bdefer\b/i.test(attrs);
    const asyncAttr = /\basync\b/i.test(attrs);
    const moduleAttr = /\btype=["']module["']/i.test(attrs);
    const src = srcMatch ? srcMatch[1] : '';
    scripts.push({
      order: index++,
      src: src || null,
      inline: !src,
      bytes: src ? null : body.length,
      defer,
      async: asyncAttr,
      module: moduleAttr,
      category: categorizeSource(src, body)
    });
  }
  return scripts;
}

function categorizeSource(src, body) {
  if (!src) {
    if (/Low-End|記憶體|Lite Mode/i.test(body)) return 'inline-lite-helpers';
    return 'inline-script';
  }
  if (/^https?:\/\//i.test(src)) {
    if (/font-awesome|cdnjs/i.test(src)) return 'cdn-ui';
    return 'cdn-other';
  }
  if (src.includes('/js/pages/')) return 'page-entry';
  if (src.includes('/js/modules/learning-upload/')) return 'learning-upload-module';
  if (src.includes('/js/modules/ui/')) return 'ui-module';
  if (src.includes('/js/modules/')) return 'shared-module';
  if (src.includes('/js/core/')) return 'core';
  if (src.includes('/js/debug')) return 'diagnostics';
  return 'other-local';
}

function summarize(scripts) {
  const summary = { total: scripts.length, inline: 0, external: 0, categories: {} };
  scripts.forEach((s) => {
    if (s.inline) summary.inline += 1; else summary.external += 1;
    summary.categories[s.category] = (summary.categories[s.category] || 0) + 1;
  });
  return summary;
}

function formatMarkdown(summary, scripts, htmlPath) {
  const lines = [];
  lines.push(`# Learning Record Upload Script Map`);
  lines.push(`*來源檔案*: \`${htmlPath}\``);
  lines.push('');
  lines.push(`- 總 script 數：**${summary.total}**（外部 ${summary.external} / inline ${summary.inline}）`);
  lines.push(`- 類別分佈：`);
  Object.entries(summary.categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      lines.push(`  - ${category}: ${count}`);
    });
  lines.push('');
  lines.push('| # | 類別 | 來源 | defer | async | module |');
  lines.push('|---|-------|-------|-------|-------|--------|');
  scripts.forEach((s) => {
    lines.push(`| ${s.order} | ${s.category} | ${s.src ? `\`${s.src}\`` : '**inline**'} | ${s.defer ? '✅' : ''} | ${s.async ? '✅' : ''} | ${s.module ? '✅' : ''} |`);
  });
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const wantsMarkdown = args.includes('--markdown');
  const htmlArg = args.find((arg) => !arg.startsWith('-'));
  const targetHtml = htmlArg || 'public/learning-record-upload copy.html';
  const { content, resolved } = readHtml(targetHtml);
  const scripts = extractScripts(content);
  const summary = summarize(scripts);
  const markdown = formatMarkdown(summary, scripts, resolved);
  const output = {
    generatedAt: new Date().toISOString(),
    htmlPath: resolved,
    summary,
    scripts
  };
  if (wantsMarkdown) {
    console.log(markdown);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('❌ 無法產生依賴圖:', err.message);
    process.exitCode = 1;
  }
}
