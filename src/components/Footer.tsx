import { Heart, Instagram, Facebook, Twitter } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-foreground text-primary-foreground py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <a href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-serif text-xl font-bold">
                LoveMatch
              </span>
            </a>
            <p className="text-primary-foreground/60 text-sm leading-relaxed">
              Nền tảng hẹn hò hàng đầu Việt Nam, 
              giúp bạn tìm kiếm tình yêu đích thực.
            </p>
            
            {/* Social Links */}
            <div className="flex gap-4 mt-6">
              <a href="#" className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">Khám phá</h4>
            <ul className="space-y-3 text-sm text-primary-foreground/60">
              <li><a href="#" className="hover:text-primary-foreground transition-colors">Tính năng</a></li>
              <li><a href="#" className="hover:text-primary-foreground transition-colors">Premium</a></li>
              <li><a href="#" className="hover:text-primary-foreground transition-colors">Câu chuyện tình yêu</a></li>
              <li><a href="#" className="hover:text-primary-foreground transition-colors">Blog</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4">Hỗ trợ</h4>
            <ul className="space-y-3 text-sm text-primary-foreground/60">
              <li><a href="#" className="hover:text-primary-foreground transition-colors">Trung tâm trợ giúp</a></li>
              <li><a href="#" className="hover:text-primary-foreground transition-colors">Quy tắc cộng đồng</a></li>
              <li><a href="#" className="hover:text-primary-foreground transition-colors">An toàn khi hẹn hò</a></li>
              <li><a href="#" className="hover:text-primary-foreground transition-colors">Liên hệ</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">Pháp lý</h4>
            <ul className="space-y-3 text-sm text-primary-foreground/60">
              <li><a href="#" className="hover:text-primary-foreground transition-colors">Điều khoản sử dụng</a></li>
              <li><a href="#" className="hover:text-primary-foreground transition-colors">Chính sách bảo mật</a></li>
              <li><a href="#" className="hover:text-primary-foreground transition-colors">Chính sách Cookie</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-primary-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-primary-foreground/60">
            © 2024 LoveMatch. Made with 💝 in Vietnam
          </p>
          <div className="flex items-center gap-4 text-sm text-primary-foreground/60">
            <span>🇻🇳 Tiếng Việt</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
