import { useMemo } from 'react';
import Prism from 'prismjs';
import '../../utils/prismMarkup';
import 'prismjs/themes/prism-tomorrow.css';
import styles from './XmlCode.module.css';

interface XmlCodeProps {
  text: string;
}

// Renders text as syntax-highlighted XML/markup using Prism. Prism escapes the
// source, so the generated HTML is safe to inject.
function XmlCode({ text }: XmlCodeProps) {
  const html = useMemo(
    () => Prism.highlight(text, Prism.languages.markup, 'markup'),
    [text],
  );

  return (
    <pre className={styles.pre}>
      <code className="language-markup" dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}

export default XmlCode;
