import { UserPlus, Heart, MessageCircle, Sparkles } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Tạo profile",
    description: "Đăng ký miễn phí và tạo profile với những bức ảnh đẹp nhất của bạn",
  },
  {
    icon: Heart,
    title: "Swipe & Match",
    description: "Vuốt phải khi thích, vuốt trái để bỏ qua. Match khi cả hai cùng thích nhau",
  },
  {
    icon: MessageCircle,
    title: "Chat & Kết nối",
    description: "Nhắn tin, gọi video và lên kế hoạch cho buổi hẹn đầu tiên của bạn",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-24 gradient-soft overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 text-primary font-medium text-sm uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            Đơn giản & Hiệu quả
          </span>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground mt-3">
            Cách <span className="text-gradient">hoạt động</span>
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div 
              key={step.title}
              className="relative group"
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary/30 to-transparent" />
              )}
              
              <div className="glass-card p-8 text-center transition-all duration-300 hover:shadow-float hover:-translate-y-2">
                {/* Step Number */}
                <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-soft">
                  {index + 1}
                </div>

                {/* Icon */}
                <div className="w-16 h-16 mx-auto rounded-2xl gradient-primary flex items-center justify-center mb-6 shadow-soft group-hover:scale-110 transition-transform">
                  <step.icon className="w-8 h-8 text-primary-foreground" />
                </div>

                {/* Content */}
                <h3 className="font-serif text-xl font-semibold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
