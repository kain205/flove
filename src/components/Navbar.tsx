import { Heart, Menu } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-soft group-hover:scale-105 transition-transform">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-serif text-xl font-bold text-foreground">
              LoveMatch
            </span>
          </a>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              Tính năng
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              Câu chuyện tình yêu
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              Hỗ trợ
            </a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost">Đăng nhập</Button>
            <Button variant="default">Đăng ký</Button>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2"
            onClick={() => setIsOpen(!isOpen)}
          >
            <Menu className="w-6 h-6 text-foreground" />
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border/50">
            <div className="flex flex-col gap-4">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors py-2">
                Tính năng
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors py-2">
                Câu chuyện tình yêu
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors py-2">
                Hỗ trợ
              </a>
              <div className="flex flex-col gap-2 pt-4 border-t border-border/50">
                <Button variant="ghost" className="w-full justify-center">Đăng nhập</Button>
                <Button variant="default" className="w-full justify-center">Đăng ký</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
