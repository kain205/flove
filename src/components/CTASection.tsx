import { Heart, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";

const CTASection = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-primary opacity-95" />
      
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Heart className="absolute top-10 left-[10%] w-20 h-20 text-primary-foreground/10 floating-heart" />
        <Heart className="absolute bottom-10 right-[10%] w-16 h-16 text-primary-foreground/10 floating-heart" style={{ animationDelay: '1s' }} />
        <Heart className="absolute top-1/2 left-[5%] w-12 h-12 text-primary-foreground/10 floating-heart" style={{ animationDelay: '0.5s' }} />
        <Heart className="absolute top-20 right-[20%] w-10 h-10 text-primary-foreground/10 floating-heart" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
            Sẵn sàng tìm kiếm
            <br />
            tình yêu đích thực?
          </h2>
          <p className="text-xl text-primary-foreground/80 mb-10 max-w-xl mx-auto">
            Hơn 2 triệu người độc thân đang chờ đợi để gặp bạn. 
            Đăng ký miễn phí ngay hôm nay!
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" variant="secondary" className="group text-foreground">
              Tạo tài khoản miễn phí
              <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-8 mt-12 text-primary-foreground/60 text-sm">
            <span>🔒 Bảo mật cao</span>
            <span>✨ Miễn phí cơ bản</span>
            <span>💝 Cam kết chất lượng</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
