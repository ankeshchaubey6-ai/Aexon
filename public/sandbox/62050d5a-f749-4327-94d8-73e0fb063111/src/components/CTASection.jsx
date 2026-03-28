export default function CTASection() {
  return (
    <section id="cta" className="bg-indigo-600 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-lg mb-8">Join thousands of users who trust our landing page solution.</p>
        <form className="flex flex-col sm:flex-row justify-center max-w-md mx-auto">
          <input
            type="email"
            placeholder="Enter your email"
            className="w-full sm:w-auto flex-grow px-4 py-3 rounded-md text-gray-900 mb-2 sm:mb-0 sm:mr-2 focus:outline-none"
          />
          <button
            type="submit"
            className="bg-white text-indigo-600 font-semibold px-6 py-3 rounded-md hover:bg-gray-100 transition"
          >
            Sign Up
          </button>
        </form>
      </div>
    </section>
  );
}