const features = [
  {
    title: 'Responsive Design',
    description: 'Looks great on any device, from mobile to desktop.',
    icon: '📱',
  },
  {
    title: 'SEO Optimized',
    description: 'Built with best practices for search engine visibility.',
    icon: '🔍',
  },
  {
    title: 'Analytics Ready',
    description: 'Easily integrate Google Analytics or any tracking tool.',
    icon: '📊',
  },
];

export default function FeatureSection() {
  return (
    <section id="features" className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">Features</h2>
          <p className="mt-4 text-lg text-gray-600">Everything you need for a high-converting landing page.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div key={feature.title} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}