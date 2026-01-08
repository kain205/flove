import { useState } from 'react';
import { Heart, Sparkles, ArrowRight, Compass, Shuffle, MessageCircle, Users, Shield, Zap } from 'lucide-react';
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
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <a href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-soft group-hover:scale-105 transition-transform">
                <Heart className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
              </div>
              <span className="font-serif text-xl font-bold text-foreground">F-Connect</span>
            </a>

            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => setShowLogin(true)}>
                Đăng nhập
              </Button>
              <Button onClick={() => setShowLogin(true)} className="gradient-primary text-primary-foreground">
                Bắt đầu
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden gradient-soft pt-16">
        {/* Floating Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Heart className="absolute top-24 left-[10%] w-8 h-8 text-primary/20 floating-heart" style={{ animationDelay: '0s' }} />
          <Heart className="absolute top-40 right-[15%] w-6 h-6 text-coral/20 floating-heart" style={{ animationDelay: '0.5s' }} />
          <Sparkles className="absolute top-32 right-[30%] w-6 h-6 text-accent/30 floating-heart" style={{ animationDelay: '0.3s' }} />
          <Heart className="absolute bottom-40 left-[20%] w-10 h-10 text-rose/15 floating-heart" style={{ animationDelay: '1s' }} />
        </div>

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center mb-10">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blush text-deep-rose text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                Dành riêng cho sinh viên FPT
              </span>

              <h1 className="font-serif text-3xl md:text-5xl font-bold text-foreground mb-4">
                Tìm kiếm{" "}
                <span className="text-gradient">tình yêu</span>
                {" "}trong khuôn viên FPT
              </h1>

              <p className="text-base text-muted-foreground max-w-xl mx-auto">
                Kết nối với sinh viên FPT qua 2 tính năng độc đáo
              </p>
            </div>

            {/* Feature Cards - ngay trong Hero */}
            <div className="grid md:grid-cols-2 gap-6 mb-10">
              {/* Feature 1: Discovery */}
              <div className="relative p-6 rounded-2xl bg-card/80 backdrop-blur-sm shadow-card border border-border/50 overflow-hidden group hover:shadow-float transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 gradient-orange opacity-10 blur-2xl" />
                
                <div className="relative flex gap-4">
                  <div className="w-14 h-14 rounded-xl gradient-orange flex items-center justify-center shadow-soft flex-shrink-0">
                    <Compass className="w-7 h-7 text-primary-foreground" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-serif text-xl font-bold text-foreground mb-2">
                      Discovery Mode
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Swipe profiles sinh viên FPT. Like hoặc Pass. Match khi cả hai cùng thích!
                    </p>
                    
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        Swipe Cards
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        Instant Match
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 2: Blind Date */}
              <div className="relative p-6 rounded-2xl bg-card/80 backdrop-blur-sm shadow-card border border-border/50 overflow-hidden group hover:shadow-float transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-accent opacity-10 blur-2xl" />
                
                <div className="relative flex gap-4">
                  <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center shadow-soft flex-shrink-0">
                    <Shuffle className="w-7 h-7 text-accent-foreground" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-serif text-xl font-bold text-foreground mb-2">
                      Blind Date
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Chat ẩn danh với sinh viên FPT ngẫu nhiên. Reveal khi cả hai sẵn sàng!
                    </p>
                    
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                        Anonymous
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                        Safe Chat
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA + Stats */}
            <div className="text-center">
              <Button 
                size="lg" 
                onClick={() => setShowLogin(true)}
                className="gradient-primary text-primary-foreground h-12 px-8 rounded-xl text-base font-semibold shadow-card hover:shadow-float transition-all group mb-8"
              >
                Bắt đầu ngay
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>

              <div className="flex justify-center gap-10">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gradient">5K+</p>
                  <p className="text-xs text-muted-foreground">Sinh viên</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gradient">1K+</p>
                  <p className="text-xs text-muted-foreground">Matches</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gradient">4</p>
                  <p className="text-xs text-muted-foreground">Campus</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 gradient-soft">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
              Cách hoạt động
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 shadow-card">
                <Users className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">1. Đăng ký</h3>
              <p className="text-sm text-muted-foreground">
                Sử dụng email FPT của bạn để tạo tài khoản
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 rounded-full gradient-orange flex items-center justify-center mx-auto mb-4 shadow-card">
                <MessageCircle className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">2. Kết nối</h3>
              <p className="text-sm text-muted-foreground">
                Swipe profiles hoặc chat ẩn danh với Blind Date
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center mx-auto mb-4 shadow-card">
                <Heart className="w-7 h-7 text-accent-foreground fill-accent-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">3. Match</h3>
              <p className="text-sm text-muted-foreground">
                Nhắn tin và hẹn hò với người bạn thích
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-card border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 text-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-sm">Chỉ sinh viên FPT</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="w-5 h-5 text-primary" />
              <span className="text-sm">Match nhanh chóng</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Heart className="w-5 h-5 text-primary" />
              <span className="text-sm">Bảo mật tuyệt đối</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 gradient-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-foreground mb-6">
            Sẵn sàng tìm kiếm tình yêu?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-md mx-auto">
            Hàng nghìn sinh viên FPT đang chờ kết nối với bạn
          </p>
          <Button 
            size="lg" 
            onClick={() => setShowLogin(true)}
            className="bg-card text-foreground hover:bg-card/90 h-14 px-8 rounded-2xl text-base font-semibold shadow-float"
          >
            Tham gia ngay
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-foreground/5 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary fill-primary" />
              <span className="font-serif font-bold text-foreground">F-Connect</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 F-Connect. Made for FPT Students.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
