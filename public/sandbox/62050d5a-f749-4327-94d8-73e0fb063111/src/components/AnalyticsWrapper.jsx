import useAnalytics from '../hooks/useAnalytics';

export default function AnalyticsWrapper({ children }) {
  useAnalytics();
  return <>{children}</>;
}