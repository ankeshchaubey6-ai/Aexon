import { useState, useEffect } from "react";

/**
 * Typewriter effect cycling through an array of strings.
 */
export function Typewriter({ words = [], speed = 80, deleteSpeed = 40, pause = 2000, className }) {
  const [text, setText] = useState("");
  const [wordIdx, setWordIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[wordIdx % words.length];
    const timeout = setTimeout(() => {
      if (!deleting) {
        setText(word.slice(0, text.length + 1));
        if (text.length + 1 === word.length) setTimeout(() => setDeleting(true), pause);
      } else {
        setText(word.slice(0, text.length - 1));
        if (text.length === 1) { setDeleting(false); setWordIdx(i => i + 1); }
      }
    }, deleting ? deleteSpeed : speed);
    return () => clearTimeout(timeout);
  }, [text, deleting, wordIdx, words, speed, deleteSpeed, pause]);

  return <span className={className}>{text}<span className="animate-pulse">|</span></span>;
}
