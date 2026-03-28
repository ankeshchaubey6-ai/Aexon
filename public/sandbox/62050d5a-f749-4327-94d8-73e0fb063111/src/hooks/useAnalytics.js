import { useEffect } from 'react';
import { initGA } from '../utils/analytics';

export default function useAnalytics() {
  useEffect(() => {
    initGA();
  }, []);
}