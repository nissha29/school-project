import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">
              The RADU E-Token System &#9415;
            </h3>
            <p className="text-sm">
              Empowering schools with innovative point management solutions.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/"
                  className="text-sm hover:text-blue-400 transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="#about"
                  className="text-sm hover:text-blue-400 transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  to="#features"
                  className="text-sm hover:text-blue-400 transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  to="#contact"
                  className="text-sm hover:text-blue-400 transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/privacy"
                  className="text-sm hover:text-blue-400 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-sm hover:text-blue-400 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Connect With Us</h3>
            <div className="flex space-x-4">
              <Link
                to="#"
                className="text-white hover:text-blue-400 transition-colors"
              >
                <Facebook className="h-6 w-6" />
              </Link>
              <Link
                to="#"
                className="text-white hover:text-blue-400 transition-colors"
              >
                <Twitter className="h-6 w-6" />
              </Link>
              <Link
                to="#"
                className="text-white hover:text-blue-400 transition-colors"
              >
                <Instagram className="h-6 w-6" />
              </Link>
              <Link
                to="#"
                className="text-white hover:text-blue-400 transition-colors"
              >
                <Linkedin className="h-6 w-6" />
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-700 text-center text-sm">
          <div className="flex flex-col items-center space-y-4">
            <div className="flex items-center space-x-3">
              <img
                src="/radu-logo-2.png"
                alt="RADU E-Token Logo"
                className="h-8 w-auto"
              />
              <p className="text-base font-medium">
                RADU E-Token — Sometimes being seen is all it takes to stay.
              </p>
            </div>
            <div className="space-y-2">
              <p>
                &copy; {new Date().getFullYear()} The RADU E-Token System
                &#9415; All rights reserved.
              </p>
              <p>Powered by Affective Academy LLC.</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
