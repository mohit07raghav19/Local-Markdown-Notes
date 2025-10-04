/**
 * Markdown Utilities
 * Helper functions for markdown processing
 */
const MarkdownUtils = (() => {
  /**
   * Simple Markdown to HTML converter
   * Note: For a production app, consider using a full markdown library
   * @param {string} markdown - The markdown text to convert
   * @returns {string} HTML representation of the markdown
   */
  function markdownToHTML(markdown) {
    if (!markdown) return "";

    // Process code blocks with language
    let html = markdown.replace(
      /```(\w+)?\n([\s\S]+?)\n```/g,
      function (match, language, code) {
        return `<pre><code class="language-${language || ""}">${escapeHTML(
          code
        )}</code></pre>`;
      }
    );

    // Process inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Process headers
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    // Process lists
    html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
    html = html.replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>");
    html = html.replace(/(<li>.*<\/li>\n)+/g, "<ul>$&</ul>");

    // Process checkboxes
    html = html.replace(
      /- \[ \] (.+)$/gm,
      '<li><input type="checkbox"> $1</li>'
    );
    html = html.replace(
      /- \[x\] (.+)$/gm,
      '<li><input type="checkbox" checked> $1</li>'
    );

    // Process bold and italic
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Process links and images
    html = html.replace(/!\[([^\]]+)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Process paragraphs (must come last)
    html = html.replace(/^([^<].*[^>])$/gm, "<p>$1</p>");
    html = html.replace(/<\/p>\n<p>/g, "</p><p>");

    return html;
  }

  /**
   * Escape HTML special characters
   * @param {string} unsafe - The string to escape
   * @returns {string} Escaped HTML string
   */
  function escapeHTML(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Apply a markdown snippet template to the editor
   * @param {HTMLTextAreaElement} editor - The editor element
   * @param {string} template - The snippet template to apply
   */
  function applySnippet(editor, template) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);

    // Get text before and after cursor (no slash removal here - handled by slashPalette)
    const textBefore = editor.value.substring(0, start);
    const textAfter = editor.value.substring(end);

    // Process placeholders in the format ${1:default}
    const placeholderRegex = /\$\{(\d+):([^}]*)\}/g;
    const placeholders = []; // Array to store placeholder info: {index, number, text, startPos, endPos}

    // First pass: collect all placeholder information and replace them with their default values
    let processedTemplate = template;
    let result = "";
    let lastIndex = 0;
    let match;

    // Extract all placeholders
    while ((match = placeholderRegex.exec(template)) !== null) {
      const fullMatch = match[0];
      const num = parseInt(match[1], 10);
      const defaultText = match[2] || "";

      placeholders.push({
        number: num,
        text: defaultText,
        fullMatch,
        matchIndex: match.index,
      });
    }

    // Sort placeholders by number
    placeholders.sort((a, b) => a.number - b.number);

    // If we have placeholders and selected text, use selected text for the first placeholder
    if (placeholders.length > 0 && selectedText) {
      const firstPlaceholder = placeholders[0];
      const beforeMatch = template.substring(0, firstPlaceholder.matchIndex);
      const afterMatch = template.substring(
        firstPlaceholder.matchIndex + firstPlaceholder.fullMatch.length
      );
      processedTemplate = beforeMatch + selectedText + afterMatch;

      // Update positions for remaining placeholders
      const lengthDiff =
        selectedText.length - firstPlaceholder.fullMatch.length;
      for (let i = 1; i < placeholders.length; i++) {
        if (placeholders[i].matchIndex > firstPlaceholder.matchIndex) {
          placeholders[i].matchIndex += lengthDiff;
        }
      }

      // Remove the first placeholder as we've processed it
      placeholders.shift();
    }

    // Now build the result with placeholders converted to their default text
    let currentPos = 0;
    let targetPlaceholder = null;

    // Process the first remaining placeholder specially to position cursor there
    if (placeholders.length > 0) {
      targetPlaceholder = placeholders[0];

      result = processedTemplate.substring(0, targetPlaceholder.matchIndex);
      currentPos = targetPlaceholder.matchIndex;

      // Store cursor position information relative to result
      const selectionStart = result.length;
      result += targetPlaceholder.text;
      const selectionEnd = result.length;

      // Store positions for later setting the cursor
      targetPlaceholder.startPos = textBefore.length + selectionStart;
      targetPlaceholder.endPos = textBefore.length + selectionEnd;

      // Continue from after this placeholder
      currentPos += targetPlaceholder.fullMatch.length;

      // Add the rest of the string up to the next placeholder or end
      result += processedTemplate.substring(currentPos);

      // Now replace other placeholders with their default text
      for (let i = 1; i < placeholders.length; i++) {
        const placeholder = placeholders[i];
        const regex = new RegExp(escapeRegExp(placeholder.fullMatch), "g");
        result = result.replace(regex, placeholder.text);
      }
    } else {
      // No placeholders or all processed
      result = processedTemplate;
    }

    // Update editor
    editor.value = textBefore + result + textAfter;

    // Set cursor position to the target placeholder
    if (targetPlaceholder) {
      editor.selectionStart = targetPlaceholder.startPos;
      editor.selectionEnd = targetPlaceholder.endPos;
    } else {
      // No target placeholder, put cursor at end of inserted content
      const newPos = textBefore.length + result.length;
      editor.selectionStart = editor.selectionEnd = newPos;
    }

    editor.focus();
  }

  /**
   * Escape special characters for use in regular expressions
   * @param {string} string - The string to escape
   * @returns {string} Escaped string
   */
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Public API
  return {
    markdownToHTML,
    escapeHTML,
    applySnippet,
  };
})();
