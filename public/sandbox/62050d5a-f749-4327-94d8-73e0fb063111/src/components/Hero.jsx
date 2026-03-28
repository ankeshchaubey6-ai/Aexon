export default function Hero() {
  return (
    <section className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-6">
          Build Amazing Landing Pages
        </h1>
        <p className="text-lg md:text-xl max-w-2xl mx-auto mb-8">
          Fast, responsive, and SEO-optimized landing pages built with Vite, React, and Tailwind CSS.
        </p>
        <div className="flex justify-center space-x-4">
          <a
            href="#cta"
            className="bg-white text-indigo-600 font-semibold px-6 py-3 rounded-md hover:bg-gray-100 transition"
          >
            Get Started
          </a>
          <a
            href="#features"
            className="bg-transparent border border-white text-white font-semibold px-6 py-3 rounded-md hover:bg-white hover:text-indigo-600 transition"
          >
            Learn More
          </a>
        </div>
      </div>
    </section>
  );
}