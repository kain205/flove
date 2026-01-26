import { useState } from 'react';
import { Heart, Sparkles, ArrowRight, Compass, Shuffle, MessageCircle, Users, Shield, Zap, Star, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LoginPage from '@/features/auth/pages/LoginPage';
import { User } from '@/types';

interface LandingPageProps {
  onLoginSuccess: (user: User) => void;
}

const LandingPage = ({ onLoginSuccess }: LandingPageProps) => {
  const [showLogin, setShowLogin] = useState(false);

  if (showLogin) {
    return <LoginPage onLoginSuccess={onLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar - Floating glassmorphism */}
      <nav className="fixed top-4 left-4 right-4 z-50 glass rounded-2xl border border-border/30 shadow-card">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <a href="/" className="flex items-center gap-3 group cursor-pointer">
              <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-soft group-hover:shadow-glow transition-shadow duration-300">
                <Heart className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
              </div>
              <span className="font-serif text-xl font-bold text-foreground">F-Love</span>
            </a>

            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => setShowLogin(true)}
                className="text-foreground hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                Đăng nhập
              </Button>
              <Button 
                onClick={() => setShowLogin(true)} 
                className="gradient-primary text-primary-foreground rounded-xl shadow-soft hover:shadow-card transition-all duration-300 btn-shine cursor-pointer"
              >
                Bắt đầu
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Aurora mesh background */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden gradient-soft pt-24 pb-16">
        {/* Aurora mesh overlay */}
        <div className="absolute inset-0 bg-aurora pointer-events-none" />
        
        {/* Floating Elements - Improved animations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Heart className="absolute top-28 left-[8%] w-10 h-10 text-primary/15 floating-heart" style={{ animationDelay: '0s' }} />
          <Heart className="absolute top-44 right-[12%] w-7 h-7 text-coral/20 floating-heart" style={{ animationDelay: '0.5s' }} />
          <Sparkles className="absolute top-36 right-[28%] w-8 h-8 text-accent/20 floating-heart" style={{ animationDelay: '0.3s' }} />
          <Heart className="absolute bottom-44 left-[18%] w-12 h-12 text-rose/10 floating-heart" style={{ animationDelay: '1s' }} />
          <Star className="absolute top-52 left-[45%] w-6 h-6 text-primary/15 floating-heart" style={{ animationDelay: '0.7s' }} />
          <Heart className="absolute bottom-32 right-[15%] w-8 h-8 text-coral/15 floating-heart" style={{ animationDelay: '1.3s' }} />
        </div>

        <div className="container mx-auto px-4 py-8 relative z-10">
          <div className="max-w-5xl mx-auto">
            {/* Header - Enhanced visual hierarchy */}
            <div className="text-center mb-12 animate-slide-up">
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blush/80 backdrop-blur-sm text-deep-rose text-sm font-semibold mb-6 shadow-soft border border-rose/10">
                <Sparkles className="w-4 h-4" />
                Dành riêng cho sinh viên FPT
              </span>

              <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
                Tìm kiếm{" "}
                <span className="text-gradient relative">
                  tình yêu
                  <svg className="absolute -bottom-2 left-0 w-full" height="8" viewBox="0 0 200 8" fill="none">
                    <path d="M2 6C50 2 150 2 198 6" stroke="hsl(22 89% 55%)" strokeWidth="3" strokeLinecap="round" opacity="0.3"/>
                  </svg>
                </span>
                <br className="hidden sm:block" />
                <span className="text-foreground/90">trong khuôn viên FPT</span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Kết nối với sinh viên FPT qua <span className="text-foreground font-medium">2 tính năng độc đáo</span> — 
                Discovery Mode và Blind Date
              </p>
            </div>

            {/* Feature Cards - Enhanced with glassmorphism and hover effects */}
            <div className="grid md:grid-cols-2 gap-6 mb-12 animate-slide-up-delay-1">
              {/* Feature 1: Discovery */}
              <div className="group relative p-7 rounded-3xl glass-card shadow-card overflow-hidden cursor-pointer card-hover">
                {/* Gradient orb */}
                <div className="absolute -top-10 -right-10 w-40 h-40 gradient-orange opacity-20 blur-3xl group-hover:opacity-30 transition-opacity duration-500" />
                
                <div className="relative flex gap-5">
                  <div className="w-16 h-16 rounded-2xl gradient-orange flex items-center justify-center shadow-card flex-shrink-0 group-hover:shadow-glow transition-shadow duration-300">
                    <Compass className="w-8 h-8 text-primary-foreground" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-serif text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors duration-300">
                      Discovery Mode
                    </h3>
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      Swipe profiles sinh viên FPT. Like hoặc Pass. Match khi cả hai cùng thích!
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                        Swipe Cards
                      </span>
                      <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                        Instant Match
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Hover arrow indicator */}
                <div className="absolute bottom-6 right-6 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                  <ArrowRight className="w-5 h-5 text-primary" />
                </div>
              </div>

              {/* Feature 2: Blind Date */}
              <div className="group relative p-7 rounded-3xl glass-card shadow-card overflow-hidden cursor-pointer card-hover">
                {/* Gradient orb */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent opacity-15 blur-3xl group-hover:opacity-25 transition-opacity duration-500" />
                
                <div className="relative flex gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center shadow-card flex-shrink-0 group-hover:shadow-glow transition-shadow duration-300">
                    <Shuffle className="w-8 h-8 text-accent-foreground" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-serif text-2xl font-bold text-foreground mb-3 group-hover:text-accent transition-colors duration-300">
                      Blind Date
                    </h3>
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      Chat ẩn danh với sinh viên FPT ngẫu nhiên. Reveal khi cả hai sẵn sàng!
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold border border-accent/20">
                        Anonymous
                      </span>
                      <span className="px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold border border-accent/20">
                        Safe Chat
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Hover arrow indicator */}
                <div className="absolute bottom-6 right-6 w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                  <ArrowRight className="w-5 h-5 text-accent" />
                </div>
              </div>
            </div>

            {/* CTA + Stats - Enhanced */}
            <div className="text-center animate-slide-up-delay-2">
              <Button 
                size="lg" 
                onClick={() => setShowLogin(true)}
                className="gradient-primary text-primary-foreground h-14 px-10 rounded-2xl text-lg font-semibold shadow-card hover:shadow-float transition-all duration-300 group btn-shine cursor-pointer"
              >
                Bắt đầu ngay
                <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>

              {/* Stats - Improved design */}
              <div className="flex justify-center gap-12 mt-12">
                <div className="text-center group cursor-default">
                  <p className="text-3xl md:text-4xl font-bold text-gradient group-hover:scale-105 transition-transform duration-300">5K+</p>
                  <p className="text-sm text-muted-foreground mt-1 font-medium">Sinh viên</p>
                </div>
                <div className="w-px bg-border/50" />
                <div className="text-center group cursor-default">
                  <p className="text-3xl md:text-4xl font-bold text-gradient group-hover:scale-105 transition-transform duration-300">1K+</p>
                  <p className="text-sm text-muted-foreground mt-1 font-medium">Matches</p>
                </div>
                <div className="w-px bg-border/50" />
                <div className="text-center group cursor-default">
                  <p className="text-3xl md:text-4xl font-bold text-gradient group-hover:scale-105 transition-transform duration-300">4</p>
                  <p className="text-sm text-muted-foreground mt-1 font-medium">Campus</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Enhanced visual design */}
      <section className="py-24 bg-card relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 bg-aurora opacity-50 pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary text-sm font-semibold mb-4">
              <Sparkles className="w-4 h-4" />
              Đơn giản & Hiệu quả
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground">
              Cách hoạt động
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10 max-w-5xl mx-auto">
            {/* Step 1 */}
            <div className="relative group">
              <div className="text-center p-8 rounded-3xl bg-background glass-card shadow-soft card-hover cursor-default">
                {/* Step number */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold shadow-card">
                  1
                </div>
                <div className="w-18 h-18 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-5 shadow-card group-hover:shadow-glow transition-shadow duration-300">
                  <Users className="w-9 h-9 text-primary-foreground" />
                </div>
                <h3 className="font-serif text-xl font-bold text-foreground mb-3">Đăng ký</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Sử dụng email FPT của bạn để tạo tài khoản an toàn
                </p>
              </div>
              {/* Connector line */}
              <div className="hidden md:block absolute top-1/2 -right-5 w-10 border-t-2 border-dashed border-border" />
            </div>

            {/* Step 2 */}
            <div className="relative group">
              <div className="text-center p-8 rounded-3xl bg-background glass-card shadow-soft card-hover cursor-default">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full gradient-orange flex items-center justify-center text-primary-foreground text-sm font-bold shadow-card">
                  2
                </div>
                <div className="w-18 h-18 rounded-2xl gradient-orange flex items-center justify-center mx-auto mb-5 shadow-card group-hover:shadow-glow transition-shadow duration-300">
                  <MessageCircle className="w-9 h-9 text-primary-foreground" />
                </div>
                <h3 className="font-serif text-xl font-bold text-foreground mb-3">Kết nối</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Swipe profiles hoặc chat ẩn danh với Blind Date
                </p>
              </div>
              {/* Connector line */}
              <div className="hidden md:block absolute top-1/2 -right-5 w-10 border-t-2 border-dashed border-border" />
            </div>

            {/* Step 3 */}
            <div className="relative group">
              <div className="text-center p-8 rounded-3xl bg-background glass-card shadow-soft card-hover cursor-default">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-sm font-bold shadow-card">
                  3
                </div>
                <div className="w-18 h-18 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-5 shadow-card group-hover:shadow-glow transition-shadow duration-300">
                  <Heart className="w-9 h-9 text-accent-foreground fill-accent-foreground" />
                </div>
                <h3 className="font-serif text-xl font-bold text-foreground mb-3">Match</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Nhắn tin và hẹn hò với người bạn thích
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section - Enhanced */}
      <section className="py-12 bg-background border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-10 text-center">
            <div className="flex items-center gap-3 text-muted-foreground group cursor-default hover:text-foreground transition-colors duration-300">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium">Chỉ sinh viên FPT</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground group cursor-default hover:text-foreground transition-colors duration-300">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium">Match nhanh chóng</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground group cursor-default hover:text-foreground transition-colors duration-300">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium">Bảo mật tuyệt đối</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA - Enhanced gradient and effects */}
      <section className="py-24 gradient-primary relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
            Sẵn sàng tìm kiếm tình yêu?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-10 max-w-lg mx-auto">
            Hàng nghìn sinh viên FPT đang chờ kết nối với bạn
          </p>
          <Button 
            size="lg" 
            onClick={() => setShowLogin(true)}
            className="bg-card text-foreground hover:bg-card/95 h-16 px-10 rounded-2xl text-lg font-semibold shadow-float hover:scale-105 transition-all duration-300 cursor-pointer"
          >
            Tham gia ngay
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer - Enhanced */}
      <footer className="py-10 bg-foreground/[0.02] border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-soft group-hover:shadow-glow transition-shadow duration-300">
                <Heart className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
              </div>
              <span className="font-serif text-lg font-bold text-foreground">F-Love</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 F-Love. Made with <Heart className="w-4 h-4 inline text-accent fill-accent" /> for FPT Students.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
