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

    const lines = markdown.split(/\r?\n/);
    const htmlBlocks = [];

    let inCodeBlock = false;
    let codeBlockLang = "";
    let codeBlockLines = [];

    // Keep track of open lists using a stack
    // Each list on the stack is { type: 'ul' | 'ol', indent: number }
    const listStack = [];

    // Helper to close all currently open lists
    function closeAllLists() {
      while (listStack.length > 0) {
        const popped = listStack.pop();
        htmlBlocks.push(`</${popped.type}>`);
      }
    }

    // Helper to close lists down to a certain indent level
    function closeListsToIndent(indent) {
      while (listStack.length > 0 && listStack[listStack.length - 1].indent > indent) {
        const popped = listStack.pop();
        htmlBlocks.push(`</${popped.type}>`);
      }
    }

    // Paragraph buffer
    let paragraphLines = [];
    function flushParagraph() {
      if (paragraphLines.length > 0) {
        const content = paragraphLines.join("\n");
        htmlBlocks.push(`<p>${parseInline(content)}</p>`);
        paragraphLines = [];
      }
    }

    // Blockquote buffer
    let blockquoteLines = [];
    function flushBlockquote() {
      if (blockquoteLines.length > 0) {
        const blockquoteContent = blockquoteLines.join("\n");
        // Recursively render blockquote content so it can contain headings, lists, etc.
        htmlBlocks.push(`<blockquote>${markdownToHTML(blockquoteContent)}</blockquote>`);
        blockquoteLines = [];
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1. Code Block handling
      const codeBlockMatch = line.match(/^\s*```(\w*)/);

      if (inCodeBlock) {
        if (codeBlockMatch) {
          // End of code block
          const codeContent = codeBlockLines.join("\n");
          htmlBlocks.push(`<pre><code class="language-${codeBlockLang}">${escapeHTML(codeContent)}</code></pre>`);
          codeBlockLines = [];
          inCodeBlock = false;
          codeBlockLang = "";
        } else {
          codeBlockLines.push(line);
        }
        continue;
      }

      if (codeBlockMatch) {
        flushParagraph();
        flushBlockquote();
        closeAllLists();
        inCodeBlock = true;
        codeBlockLang = codeBlockMatch[1] || "";
        continue;
      }

      const trimmed = line.trim();

      // 2. Blank line
      if (trimmed === "") {
        flushParagraph();
        flushBlockquote();
        // Do not close lists on blank lines to allow spaced/loose list items
        continue;
      }

      // 3. Headings
      const headingMatch = line.match(/^(\s*)(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushParagraph();
        flushBlockquote();
        closeAllLists();
        const level = headingMatch[2].length;
        const content = headingMatch[3];
        htmlBlocks.push(`<h${level}>${parseInline(content)}</h${level}>`);
        continue;
      }

      // 4. Horizontal Rules
      if (/^(?:\s*[-*_]){3,}\s*$/.test(line)) {
        flushParagraph();
        flushBlockquote();
        closeAllLists();
        htmlBlocks.push("<hr>");
        continue;
      }

      // 5. Blockquotes
      const blockquoteMatch = line.match(/^(\s*)>\s?(.*)$/);
      if (blockquoteMatch) {
        flushParagraph();
        closeAllLists();
        const content = blockquoteMatch[2];
        blockquoteLines.push(content);
        continue;
      }

      // Since this is not a blockquote line, flush any active blockquote
      flushBlockquote();

      // 6. List items
      const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
      const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);

      if (ulMatch || olMatch) {
        flushParagraph();

        let type, indent, content;
        if (ulMatch) {
          type = "ul";
          indent = ulMatch[1].replace(/\t/g, "    ").length;
          content = ulMatch[3];
        } else {
          type = "ol";
          indent = olMatch[1].replace(/\t/g, "    ").length;
          content = olMatch[3];
        }

        if (listStack.length === 0) {
          listStack.push({ type, indent });
          htmlBlocks.push(`<${type}>`);
        } else {
          const top = listStack[listStack.length - 1];
          if (indent > top.indent) {
            // Nested list
            listStack.push({ type, indent });
            htmlBlocks.push(`<${type}>`);
          } else if (indent < top.indent) {
            closeListsToIndent(indent);
            if (listStack.length === 0) {
              listStack.push({ type, indent });
              htmlBlocks.push(`<${type}>`);
            } else {
              const currentTop = listStack[listStack.length - 1];
              if (indent === currentTop.indent && type !== currentTop.type) {
                // Change list type at the same indentation level
                listStack.pop();
                htmlBlocks.push(`</${currentTop.type}>`);
                listStack.push({ type, indent });
                htmlBlocks.push(`<${type}>`);
              }
            }
          } else if (type !== top.type) {
            // Indentation matches but list type changed
            listStack.pop();
            htmlBlocks.push(`</${top.type}>`);
            listStack.push({ type, indent });
            htmlBlocks.push(`<${type}>`);
          }
        }

        // Render list item content
        if (type === "ul") {
          const cbMatch = content.match(/^\[([ xX])\]\s+(.*)$/);
          if (cbMatch) {
            const checked = cbMatch[1].toLowerCase() === "x" ? " checked" : "";
            htmlBlocks.push(`<li><input type="checkbox"${checked}> ${parseInline(cbMatch[2])}</li>`);
          } else {
            htmlBlocks.push(`<li>${parseInline(content)}</li>`);
          }
        } else {
          htmlBlocks.push(`<li>${parseInline(content)}</li>`);
        }
        continue;
      }

      // 7. Regular paragraph line
      // Close any active lists when entering a regular paragraph block
      closeAllLists();
      paragraphLines.push(line);
    }

    // Clean up remaining buffers at the end of the document
    flushParagraph();
    flushBlockquote();
    closeAllLists();

    return htmlBlocks.join("\n");
  }

  /**
   * Parse inline Markdown syntax (bold, italic, code, links, images)
   * @param {string} text - Raw text content
   * @returns {string} HTML representation with inline tags
   */
  function parseInline(text) {
    if (!text) return "";
    let html = text;

    // Stash inline code to prevent bold/italic replacements inside code tags
    const placeholders = [];
    html = html.replace(/`([^`]+)`/g, (_, code) => {
      const id = `__INLINE_CODE_${placeholders.length}__`;
      placeholders.push({ id, html: `<code>${escapeHTML(code)}</code>` });
      return id;
    });

    // Process bold and italic
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Process links and images
    html = html.replace(/!\[([^\]]+)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Restore stashed inline code segments
    for (const placeholder of placeholders) {
      html = html.replace(placeholder.id, placeholder.html);
    }

    // Process hard line breaks (two spaces or a backslash at end of line)
    html = html.replace(/(?: {2,}|\\)$/gm, "<br>");

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
