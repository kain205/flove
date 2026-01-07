import { Heart, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden gradient-soft">
      {/* Floating Hearts Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Heart className="absolute top-20 left-[10%] w-8 h-8 text-rose/20 floating-heart" style={{ animationDelay: '0s' }} />
        <Heart className="absolute top-40 right-[15%] w-6 h-6 text-coral/20 floating-heart" style={{ animationDelay: '0.5s' }} />
        <Heart className="absolute bottom-40 left-[20%] w-10 h-10 text-rose/15 floating-heart" style={{ animationDelay: '1s' }} />
        <Heart className="absolute top-60 left-[80%] w-5 h-5 text-coral/25 floating-heart" style={{ animationDelay: '1.5s' }} />
        <Heart className="absolute bottom-60 right-[25%] w-7 h-7 text-rose/20 floating-heart" style={{ animationDelay: '2s' }} />
        <Sparkles className="absolute top-32 right-[30%] w-6 h-6 text-accent/30 floating-heart" style={{ animationDelay: '0.3s' }} />
        <Sparkles className="absolute bottom-32 left-[35%] w-5 h-5 text-coral/30 floating-heart" style={{ animationDelay: '1.2s' }} />
      </div>

      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="animate-slide-up">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blush text-deep-rose text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              #1 Dating App in Vietnam
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="font-serif text-5xl md:text-7xl font-bold text-foreground mb-6 animate-slide-up-delay-1">
            Tìm kiếm{" "}
            <span className="text-gradient">tình yêu</span>
            <br />
            đích thực của bạn
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up-delay-2">
            Kết nối với hàng triệu người độc thân đang tìm kiếm mối quan hệ nghiêm túc. 
            Thuật toán thông minh giúp bạn tìm được nửa kia hoàn hảo.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up-delay-3">
            <Button size="lg" variant="hero" className="group">
              Bắt đầu ngay
              <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button size="lg" variant="outline" className="border-2">
              Tìm hiểu thêm
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 max-w-lg mx-auto animate-slide-up-delay-3">
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-gradient">2M+</p>
              <p className="text-sm text-muted-foreground mt-1">Thành viên</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-gradient">500K</p>
              <p className="text-sm text-muted-foreground mt-1">Cặp đôi</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-gradient">98%</p>
              <p className="text-sm text-muted-foreground mt-1">Hài lòng</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
