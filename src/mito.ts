const RenderFunction = {
  /**
   * Escape HTML to XSS-safe text.
   */ 
   text: (text: string | number) => {
    if (typeof text !== 'string' && typeof text !== 'number') { return text; }
    return String(text).replace(/[<>&" ]/g, (c) => {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', ' ': '&nbsp;' }[c];
    });
  },

  /**
   * Change invisible characters to visible characters.
   */
  visibleText: (text: string) => {
    if (typeof text !== 'string') { return text; }
    return String(text).replace(/[\n\t]/g, (c) => {
      return { '\n': '\\n', '\t': '\\t' }[c];
    });
  },
};

/**
 * Mito core class.
 */
export class Mito {
  /**
   * Render a template string into an Element.
   */
  public render(tpl: string, data: any) {
    return this._render(tpl, data, false);
  }

  /**
   * Render a template string into a HTML string.
   */
  public renderToString(tpl: string, data: any) {
    return this._render(tpl, data, true);
  }

  /**
   * Render `tpl` with `data` into a HTML string.
   */
  protected _render<T extends true>(tpl: string, data: any, toString: T): string;
  /**
   * Render `tpl` with `data` into a HTML element.
   */
  protected _render<T extends false>(tpl: string, data: any, toString?: T): Element;
  protected _render<T extends boolean>(tpl: string, data: any, toString?: T) {
    const pattern = /\{\{([^\}]+)\}\}/g;
    let code = '';
    let codeWrap = '';
    let pointer = 0;
    let match: RegExpExecArray;
    
    // remove spaces after switch
    tpl = tpl.replace(/(\{\{ ?switch(.+?)\}\})[\r\n\t ]+\{\{/g, '$1{{');
    // line breaks
    tpl = tpl.replace(/^[\r\n]/, '').replace(/\n/g, '\\\n').replace(/\r/g, '\\\r');
    // init code
    codeWrap = '(function(){\n';
    code = 'var arr = [];\n';
    // renderFunctions
    for (let fn in RenderFunction) {
      code += `var ${fn} = ${RenderFunction[fn].toString()};\n`;
    }
    while (match = pattern.exec(tpl)) {
      code = this._addCode(code, tpl.slice(pointer, match.index), false );
      code = this._addCode(code, match[1], true );
      pointer = match.index + match[0].length;
    }
    code = this._addCode(code, tpl.substr(pointer, tpl.length - pointer), false );
    code += '__mito_result = arr.join("");';
    code = 'with (__mito_data) {\n' + code + '\n}';
    codeWrap += code;
    codeWrap += '})();';
    // console.log("code:\n"+codeWrap);

    // run code, do NOT use `eval` or `new Function` to avoid `unsafe-eval` CSP rule

    // init global param
    (<any>window).__mito_data = data;
    (<any>window).__mito_code = '';
    (<any>window).__mito_result = '';
    
    const script = document.createElement('SCRIPT');
    script.innerHTML = codeWrap;
    script.setAttribute('nonce', this._getNonce());
    document.documentElement.append(script);
    const domString = (<any>window).__mito_result;
    document.documentElement.removeChild(script);
    if (!toString) {
      const e = document.createElement('DIV');
      e.innerHTML = domString;
      return e.children[0];
    }
    return domString;
  }

  protected _addCode(code: string, line: string, isJS: boolean) {
    if (line === '') { return code; }
    // console.log(line)
    if (isJS) {
      if ( line.match(/^ ?else/g) ) {
        // else  --> } else {
        code += '} ' + line + ' {\n';
      } else if ( line.match(/\/(if|for|switch)/g) ) {
        // /if  -->  }
        code += '}\n';
      } else if ( line.match(/^ ?if|for|switch/g) ) {
        // if (age)  -->  if (this.age) {
        code += line + ' {\n';
      } else if ( line.match(/^ ?(break|continue) ?$/g) ) {
        // break --> break;
        code += line + ';\n';
      } else if ( line.match(/^ ?(case|default)/g) ) {
        // case (1) --> case (1):
        code += line + ':\n';
      } else {
        // name  -->  name
        code += 'arr.push(String('+ line +'));\n';
      }
    } else {
      // plain text
      code += 'arr.push("' + line.replace(/"/g, '\\"' )+ '");\n';
    }
    return code;
  }

  protected _parseTemplate(tpl: string, data: any) {

  }

  protected _getNonce() {
    const scriptList = document.getElementsByTagName('script');
    let nonce = '';
    // find the first script with nonce
    for (let i = 0; i < scriptList.length; i++) {
      if (scriptList[i].nonce) {
        nonce = scriptList[i].nonce
        break
      }
    }
    return nonce;
  }
}

export default Mito;
