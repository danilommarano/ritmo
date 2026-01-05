import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Upload, Zap, Palette, Video, Music } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-ritmo-50 via-creative-50 to-electric-50">
      {/* Navigation */}
      <nav className="relative z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-ritmo-gradient rounded-lg flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-ritmo-600 to-creative-600 bg-clip-text text-transparent">
              Ritmo
            </span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-700 hover:text-ritmo-600 transition-colors">Features</a>
            <a href="#about" className="text-gray-700 hover:text-ritmo-600 transition-colors">About</a>
            <a href="#pricing" className="text-gray-700 hover:text-ritmo-600 transition-colors">Pricing</a>
            <Link to="/app" className="px-6 py-2 bg-ritmo-gradient text-white rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105 inline-block">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8 animate-fade-in">
              <div className="inline-flex items-center px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-ritmo-200">
                <Zap className="w-4 h-4 text-ritmo-600 mr-2" />
                <span className="text-sm font-medium text-ritmo-700">More than a video editor tool</span>
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                <span className="text-gray-900">Your creative toolkit.</span>
                <br />
                <span className="bg-gradient-to-r from-ritmo-600 via-creative-600 to-energy-500 bg-clip-text text-transparent">
                  Video editing made simple and fun.
                </span>
              </h1>
              
              <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
                Smart editing, AI-powered tools, seamless teamwork, and built-in 
                assets—reimagine how you create videos with rhythm and precision.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/upload" className="px-8 py-4 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2">
                  <Upload className="w-5 h-5" />
                  <span className="font-medium">Upload Video</span>
                </Link>
                <Link to="/app" className="px-8 py-4 border-2 border-ritmo-300 text-ritmo-700 rounded-full hover:bg-ritmo-50 transition-all duration-300 flex items-center justify-center space-x-2">
                  <Play className="w-5 h-5" />
                  <span className="font-medium">Try for free</span>
                </Link>
              </div>
            </div>

            {/* Right Content - Hero Image/Illustration */}
            <div className="relative animate-float">
              <div className="relative bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 shadow-2xl border border-gray-200">
                <div className="aspect-video bg-gradient-to-br from-ritmo-100 to-creative-100 rounded-2xl flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-ritmo-gradient opacity-20"></div>
                  <div className="relative z-10 text-center space-y-4">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-lg">
                      <Play className="w-8 h-8 text-ritmo-600" />
                    </div>
                    <p className="text-ritmo-700 font-medium">Create with Rhythm</p>
                  </div>
                </div>
                
                {/* Floating elements */}
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-energy-gradient rounded-full flex items-center justify-center shadow-lg animate-pulse-slow">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-creative-gradient rounded-full flex items-center justify-center shadow-lg animate-pulse-slow">
                  <Palette className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Background decorations */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-ritmo-200 to-creative-200 rounded-full opacity-20 animate-float"></div>
        <div className="absolute bottom-20 right-10 w-24 h-24 bg-gradient-to-br from-energy-200 to-electric-200 rounded-full opacity-20 animate-float" style={{animationDelay: '2s'}}></div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-6 py-20 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything you need to create amazing videos
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Professional tools made simple, with the power of rhythm analysis and creative freedom.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature Card 1 */}
            <div className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-br from-ritmo-500 to-ritmo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Video className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Video Stabilization</h3>
              <p className="text-gray-600 leading-relaxed">
                Smooth and shaky footage for a clean, professional look with advanced stabilization algorithms.
              </p>
              <div className="mt-6 aspect-video bg-gradient-to-br from-ritmo-50 to-ritmo-100 rounded-xl flex items-center justify-center">
                <div className="text-xs text-ritmo-600 font-medium">Stabilization Preview</div>
              </div>
            </div>

            {/* Feature Card 2 */}
            <div className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-br from-creative-500 to-creative-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Palette className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Remove Background</h3>
              <p className="text-gray-600 leading-relaxed">
                Erase video background instantly—no green screen needed. Perfect for creative compositions.
              </p>
              <div className="mt-6 aspect-video bg-gradient-to-br from-creative-50 to-creative-100 rounded-xl flex items-center justify-center">
                <div className="text-xs text-creative-600 font-medium">Background Removal</div>
              </div>
            </div>

            {/* Feature Card 3 */}
            <div className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-br from-energy-500 to-energy-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Color Correction</h3>
              <p className="text-gray-600 leading-relaxed">
                Auto-adjust colors for vibrant, balanced, and high-quality videos with intelligent color grading.
              </p>
              <div className="mt-6 aspect-video bg-gradient-to-br from-energy-50 to-energy-100 rounded-xl flex items-center justify-center">
                <div className="text-xs text-energy-600 font-medium">Color Enhancement</div>
              </div>
            </div>

            {/* Feature Card 4 */}
            <div className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-br from-electric-500 to-electric-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Music className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Video Upscaler</h3>
              <p className="text-gray-600 leading-relaxed">
                Sharpen and upscale videos for crisp, HD-ready results with AI-powered enhancement technology.
              </p>
              <div className="mt-6 aspect-video bg-gradient-to-br from-electric-50 to-electric-100 rounded-xl flex items-center justify-center">
                <div className="text-xs text-electric-600 font-medium">HD Enhancement</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-gradient-to-br from-ritmo-600 via-creative-600 to-energy-500 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Your Journey, your Dance
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            A nurturing environment where you can grow, learn, and shine with the power of rhythm and creativity.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/upload" className="px-8 py-4 bg-white text-gray-900 rounded-full hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 font-medium inline-block text-center">
              Start Creating
            </Link>
            <Link to="/app" className="px-8 py-4 border-2 border-white text-white rounded-full hover:bg-white/10 transition-all duration-300 font-medium inline-block text-center">
              Watch Demo
            </Link>
          </div>
        </div>
        
        {/* Background decorations */}
        <div className="absolute top-10 right-10 w-40 h-40 bg-white/10 rounded-full animate-float"></div>
        <div className="absolute bottom-10 left-10 w-32 h-32 bg-white/10 rounded-full animate-float" style={{animationDelay: '3s'}}></div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-8 h-8 bg-ritmo-gradient rounded-lg flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold">Ritmo</span>
          </div>
          <p className="text-gray-400 mb-6">
            Empowering creators with intelligent video editing tools and rhythm analysis.
          </p>
          <div className="flex justify-center space-x-8 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
