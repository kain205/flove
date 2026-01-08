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

        <div className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blush text-deep-rose text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              Dành riêng cho sinh viên FPT
            </span>

            {/* Headline */}
            <h1 className="font-serif text-4xl md:text-6xl font-bold text-foreground mb-6">
              Tìm kiếm{" "}
              <span className="text-gradient">tình yêu</span>
              <br />
              trong khuôn viên FPT
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
              Kết nối với sinh viên FPT qua 2 tính năng độc đáo: Swipe Profiles để tìm match và Blind Date để chat ẩn danh.
            </p>

            {/* CTA */}
            <Button 
              size="lg" 
              onClick={() => setShowLogin(true)}
              className="gradient-primary text-primary-foreground h-14 px-8 rounded-2xl text-base font-semibold shadow-card hover:shadow-float transition-all group"
            >
              Bắt đầu ngay
              <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 mt-16 max-w-md mx-auto">
              <div className="text-center">
                <p className="text-3xl font-bold text-gradient">5K+</p>
                <p className="text-sm text-muted-foreground mt-1">Sinh viên</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-gradient">1K+</p>
                <p className="text-sm text-muted-foreground mt-1">Matches</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-gradient">4</p>
                <p className="text-sm text-muted-foreground mt-1">Campus</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
              2 Tính năng chính
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Hai cách để kết nối với người đặc biệt tại FPT University
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Feature 1: Discovery */}
            <div className="relative p-8 rounded-3xl bg-background shadow-card border border-border/50 overflow-hidden group hover:shadow-float transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 gradient-orange opacity-10 blur-3xl" />
              
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl gradient-orange flex items-center justify-center mb-6 shadow-soft">
                  <Compass className="w-8 h-8 text-primary-foreground" />
                </div>
                
                <h3 className="font-serif text-2xl font-bold text-foreground mb-3">
                  Discovery Mode
                </h3>
                <p className="text-muted-foreground mb-6">
                  Swipe qua các profile sinh viên FPT. Vuốt phải để Like, vuốt trái để Pass. Match ngay khi cả hai cùng thích nhau!
                </p>
                
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    Swipe Cards
                  </span>
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    Instant Match
                  </span>
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    FPT Students
                  </span>
                </div>
              </div>
            </div>

            {/* Feature 2: Blind Date */}
            <div className="relative p-8 rounded-3xl bg-background shadow-card border border-border/50 overflow-hidden group hover:shadow-float transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent opacity-10 blur-3xl" />
              
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mb-6 shadow-soft">
                  <Shuffle className="w-8 h-8 text-accent-foreground" />
                </div>
                
                <h3 className="font-serif text-2xl font-bold text-foreground mb-3">
                  Blind Date
                </h3>
                <p className="text-muted-foreground mb-6">
                  Chat ẩn danh với một sinh viên FPT ngẫu nhiên. Trò chuyện thoải mái trước, reveal danh tính khi cả hai sẵn sàng!
                </p>
                
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium">
                    Anonymous
                  </span>
                  <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium">
                    Safe Chat
                  </span>
                  <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium">
                    Reveal Later
                  </span>
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
