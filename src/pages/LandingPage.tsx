import { useState } from 'react';
import {
  ArrowRight,
  Bot,
  CalendarDays,
  Heart,
  MessageCircle,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import LoginPage from '@/features/auth/pages/LoginPage';
import { User } from '@/types';

interface LandingPageProps {
  onLoginSuccess: (user: User) => void;
  onNavigateToSignup?: () => void;
}

const LandingPage = ({ onLoginSuccess, onNavigateToSignup }: LandingPageProps) => {
  const [showLogin, setShowLogin] = useState(false);

  if (showLogin) {
    return <LoginPage onLoginSuccess={onLoginSuccess} onNavigateToSignup={onNavigateToSignup} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-4 left-4 right-4 z-50 glass rounded-2xl border border-white/20 shadow-card">
        <div className="container mx-auto px-5">
          <div className="flex items-center justify-between h-16">
            <a href="/" className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-soft">
                <Heart className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
              </div>
              <span className="font-serif text-xl font-bold text-foreground">F-Love</span>
            </a>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowLogin(true)}
                className="text-foreground hover:text-primary hover:bg-primary/5"
              >
                Đăng nhập
              </Button>
              <Button
                onClick={() => setShowLogin(true)}
                className="gradient-primary text-primary-foreground rounded-xl shadow-soft"
              >
                Bắt đầu
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <section
        className="relative min-h-[92vh] flex items-center overflow-hidden pt-24 pb-16"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.82) 45%, rgba(255,255,255,0.28) 100%), url('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&auto=format&fit=crop')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="container mx-auto px-5 relative z-10">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-5 border border-primary/15">
              <Sparkles className="w-4 h-4" />
              AI-curated dating cho sinh viên FPT
            </span>

            <h1 className="font-serif text-5xl md:text-7xl font-bold text-foreground leading-tight">
              F-Love
            </h1>
            <p className="text-xl md:text-2xl text-foreground/80 mt-5 leading-relaxed">
              Không swipe vô tận. Mỗi ngày AI chọn 3-5 người phù hợp, giải thích lý do,
              rồi học từ phản hồi của bạn để đề xuất tốt hơn.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Button
                size="lg"
                onClick={() => setShowLogin(true)}
                className="gradient-primary text-primary-foreground h-14 px-8 rounded-2xl text-base font-semibold shadow-card"
              >
                Nhận AI Picks hôm nay
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowLogin(true)}
                className="h-14 px-8 rounded-2xl bg-white/80 backdrop-blur"
              >
                Đăng nhập FPT
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-card border-y border-border/40">
        <div className="container mx-auto px-5">
          <div className="grid md:grid-cols-3 gap-5">
            <div className="p-6 rounded-2xl bg-background border border-border/60 shadow-soft">
              <CalendarDays className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-serif text-xl font-bold text-foreground">3-5 match mỗi ngày</h3>
              <p className="text-muted-foreground mt-2 leading-relaxed">
                AI giới hạn số lượng để bạn tập trung vào các kết nối đáng thử.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-background border border-border/60 shadow-soft">
              <Bot className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-serif text-xl font-bold text-foreground">Có lý do rõ ràng</h3>
              <p className="text-muted-foreground mt-2 leading-relaxed">
                Mỗi đề xuất đi kèm điểm phù hợp, sở thích chung và ngữ cảnh AI đã cân nhắc.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-background border border-border/60 shadow-soft">
              <MessageCircle className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-serif text-xl font-bold text-foreground">Feedback để học gu</h3>
              <p className="text-muted-foreground mt-2 leading-relaxed">
                Accept, decline hoặc chat với AI để tinh chỉnh đề xuất cho những ngày sau.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-5">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div>
              <div className="w-10 h-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center font-bold mb-4">
                1
              </div>
              <h3 className="font-serif text-xl font-bold text-foreground">Tạo hồ sơ</h3>
              <p className="text-muted-foreground mt-2">
                Dùng email FPT và thêm bio, sở thích, campus để AI có ngữ cảnh ban đầu.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center font-bold mb-4">
                2
              </div>
              <h3 className="font-serif text-xl font-bold text-foreground">Xem AI Picks</h3>
              <p className="text-muted-foreground mt-2">
                Mỗi ngày nhận danh sách ngắn, không có gesture swipe và không có spam hồ sơ.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center font-bold mb-4">
                3
              </div>
              <h3 className="font-serif text-xl font-bold text-foreground">Cùng đồng ý thì chat</h3>
              <p className="text-muted-foreground mt-2">
                Conversation chỉ mở khi cả hai người đều accept cùng một đề xuất.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-card border-t border-border/40">
        <div className="container mx-auto px-5">
          <div className="flex flex-wrap justify-center gap-8 text-center">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Chỉ sinh viên FPT</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Mutual accept mới mở chat</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Heart className="w-5 h-5 text-primary fill-primary" />
              <span className="text-sm font-medium">Ít match hơn, chất lượng hơn</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
