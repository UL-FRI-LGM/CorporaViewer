export class HtmlElementBuilder {
    private tag: string;
    private attributes: { [key: string]: string } = {};
    private children: (HtmlElementBuilder | string)[] = [];
    private text: string = '';

    constructor(tag: string) {
        this.tag = tag;
    }

    withAttribute(name: string, value: string): HtmlElementBuilder {
        this.attributes[name] = value;
        return this;
    }

    withText(text: string): HtmlElementBuilder {
        this.text = text;
        return this;
    }

    withChild(child: HtmlElementBuilder | string): HtmlElementBuilder {
        this.children.push(child);
        return this;
    }

    buildString(): string {
        let attrString = Object.entries(this.attributes)
            .map(([name, value]) => `${name}="${value}"`)
            .join(' ');

        if (attrString) {
            attrString = " " + attrString;
        }

        const childrenHtml = this.children
            .map(child =>
                child instanceof HtmlElementBuilder ? child.buildString() : child
            )
            .join('');

        return `<${this.tag}${attrString}>${this.text}${childrenHtml}</${this.tag}>`;
    }
}
