const testimonials = [
  {
    name: 'Jane Doe',
    role: 'Marketing Manager',
    text: 'This landing page template helped us increase our conversion rate by 40%. Highly recommended!',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
  {
    name: 'John Smith',
    role: 'Startup Founder',
    text: 'Super easy to customize and deploy. Saved us weeks of development time.',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
  },
  {
    name: 'Emily White',
    role: 'Product Designer',
    text: 'Clean code and great design. The responsiveness is flawless across all devices.',
    avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
  },
];

export default function TestimonialSection() {
  return (
    <section id="testimonials" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">What Our Users Say</h2>
          <p className="mt-4 text-lg text-gray-600">Real feedback from real users.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <div key={testimonial.name} className="bg-gray-50 p-6 rounded-lg shadow">
              <p className="text-gray-700 mb-4 italic">"{testimonial.text}"</p>
              <div className="flex items-center">
                <img
                  className="w-10 h-10 rounded-full mr-4"
                  src={testimonial.avatar}
                  alt={testimonial.name}
                />
                <div>
                  <p className="font-semibold text-gray-900">{testimonial.name}</p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}