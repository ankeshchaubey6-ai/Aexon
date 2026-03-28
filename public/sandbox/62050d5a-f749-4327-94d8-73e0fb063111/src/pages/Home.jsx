import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import FeatureSection from '../components/FeatureSection';
import TestimonialSection from '../components/TestimonialSection';
import CTASection from '../components/CTASection';
import Footer from '../components/Footer';
import { Helmet } from 'react-helmet-async';

export default function Home() {
  return (
    <>
      <Helmet>
        <title>LandingPage - Welcome</title>
        <meta name="description" content="Welcome to the best landing page ever built with Vite, React and Tailwind CSS" />
        <meta name="keywords" content="landing, page, react, vite, tailwind" />
        <meta property="og:title" content="LandingPage" />
        <meta property="og:description" content="Welcome to the best landing page ever built with Vite, React and Tailwind CSS" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="LandingPage" />
        <meta name="twitter:description" content="Welcome to the best landing page ever built with Vite, React and Tailwind CSS" />
      </Helmet>
      <Navbar />
      <Hero />
      <FeatureSection />
      <TestimonialSection />
      <CTASection />
      <Footer />
    </>
  );
}