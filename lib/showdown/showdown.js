/*
   A A L        Source code at:
   T C A   <http://www.attacklab.net/>
   T K B
*/

class Showdown {
  constructor() {
    this._links = {};
    this._titles = {};
    this._count = 0;
  }

  makeHtml(text) {
    text = this._sanitize(text);
    text = this._processMetadata(text);
    text = this._convertHeaders(text);
    text = this._convertLists(text);
    text = this._convertHorizontalRules(text);
    text = this._convertBlockquotes(text);
    text = this._convertCodeBlocks(text);
    text = this._convertParagraphs(text);
    text = this._convertInlineElements(text);
    text = this._restoreMetadata(text);
    return text.trim();
  }

  _sanitize(text) {
    text = text.replace(/~/g, "~T");
    text = text.replace(/\$/g, "~D");
    text = text.replace(/\r\n/g, "\n");
    text = text.replace(/\r/g, "\n");
    text = "\n\n" + text + "\n\n";
    return text;
  }

  _processMetadata(text) {
    text = text.replace(
      /^[ ]{0,3}\[(.+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|\Z)/gm,
      (match, p1, p2, p3, p4) => {
        const id = p1.toLowerCase();
        this._links[id] = p2;
        if (p3) {
          this._titles[id] = p4;
        }
        return "";
      }
    );
    return text;
  }

  _restoreMetadata(text) {
    text = text.replace(/~D/g, "$$");
    text = text.replace(/~T/g, "~");
    return text;
  }

  _convertHeaders(text) {
    text = text.replace(/^(.+)[ \t]*\n=+[ \t]*\n+/gm, "<h1>$1</h1>");
    text = text.replace(/^(.+)[ \t]*\n-+[ \t]*\n+/gm, "<h2>$1</h2>");
    text = text.replace(/^(\#{1,6})[ \t]*(.+?)[ \t]*\#*\n+/gm, (match, p1, p2) => {
      const level = p1.length;
      return `<h${level}>${p2}</h${level}>`;
    });
    return text;
  }

  _convertLists(text) {
    text = this._convertOrderedLists(text);
    text = this._convertUnorderedLists(text);
    return text;
  }

  _convertOrderedLists(text) {
    text = text.replace(/(\n|^)([ ]{0,3}\d+\.[ \t]+[^\r]+?(\n{1,2}))+/g, (match, p1) => {
      const items = p1.split(/\n/);
      const content = items
        .map((item) => {
          const text = item.replace(/[ ]{0,3}\d+\.[ \t]+/, "");
          return `<li>${text}</li>`;
        })
        .join("");
      return `<ol>${content}</ol>`;
    });
    return text;
  }

  _convertUnorderedLists(text) {
    text = text.replace(/(\n|^)([ ]{0,3}[*+-][ \t]+[^\r]+?(\n{1,2}))+/g, (match, p1) => {
      const items = p1.split(/\n/);
      const content = items
        .map((item) => {
          const text = item.replace(/[ ]{0,3}[*+-][ \t]+/, "");
          return `<li>${text}</li>`;
        })
        .join("");
      return `<ul>${content}</ul>`;
    });
    return text;
  }

  _convertHorizontalRules(text) {
    text = text.replace(/(\n|^)[ ]{0,3}([-*_])([ \t]*\2){2,}[ \t]*(?=\n+)/g, "<hr />");
    return text;
  }

  _convertBlockquotes(text) {
    text = text.replace(/(\n|^)[ ]{0,3}>([^\r]*?\n(.+\n)*\n*)+/g, (match) => {
      const content = match.replace(/^[ ]{0,3}>[ \t]?/gm, "");
      return `<blockquote>${this._convertParagraphs(content)}</blockquote>`;
    });
    return text;
  }

  _convertCodeBlocks(text) {
    text = text.replace(
      /(?:\n\n|^)((?:[ ]{4}|\t).*\n+)+(?=\n*(?![ ]{4}|\t))/g,
      (match) => `<pre><code>${this._encodeCode(match)}</code></pre>`
    );
    return text;
  }

  _convertParagraphs(text) {
    text = text.replace(/(\n|^)([^\r]+?)(?=\n{2,}(\n|$))/g, (match, p1, p2) => {
      return `<p>${this._encodeCode(p2)}</p>`;
    });
    return text;
  }

  _convertInlineElements(text) {
    text = this._convertStrongAndEm(text);
    text = this._convertImages(text);
    text = this._convertLinks(text);
    return text;
  }

  _convertStrongAndEm(text) {
    text = text.replace(/(\*\*|__)(?=\S)([^\r]*?\S[*_]*)\1/g, "<strong>$2</strong>");
    text = text.replace(/(\*|_)(?=\S)([^\r]*?\S)\1/g, "<em>$2</em>");
    return text;
  }

  _convertImages(text) {
    text = text.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => `<img src="${src}" alt="${alt}" />`);
    return text;
  }

  _convertLinks(text) {
    text = text.replace(
      /\[((?:\[[^\]]*\]|[^\[\]])*)\]\(([^'"\s]+)(\s*(".*?"|'.*?')?\s*)?\)/g,
      (match, text, url, title) => {
        const id = text.toLowerCase();
        const href = this._links[id] || url;
        const linkTitle = this._titles[id] || (title ? title.trim().replace(/^['"]|['"]$/g, "") : "");
        return `<a href="${href}"${linkTitle ? ` title="${linkTitle}"` : ""}>${text}</a>`;
      }
    );
    return text;
  }

  _encodeCode(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
