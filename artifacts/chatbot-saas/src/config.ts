export interface BusinessHours {
  [day: string]: string;
}

export interface Service {
  name: string;
  price: string;
}

export interface FAQ {
  q: string;
  a: string;
}

export interface ClientConfig {
  businessName: string;
  businessType: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  phone: string;
  email: string;
  address: string;
  bookingUrl: string;
  hours: BusinessHours;
  services: Service[];
  faqs: FAQ[];
  tone: string;
  welcomeMessage: string;
  fallbackMessage: string;
  leadWebhookUrl: string;
}

export const clientConfig: ClientConfig = {
  businessName: "Smile Care Dental",
  businessType: "Dental Clinic",
  tagline: "Your smile is our passion",
  primaryColor: "#2563EB",
  secondaryColor: "#EFF6FF",
  phone: "(555) 123-4567",
  email: "hello@smilecaredental.com",
  address: "123 Main Street, Suite 200, Anytown, CA 90210",
  bookingUrl: "https://smilecaredental.com/book",
  hours: {
    Monday: "8:00 AM – 5:00 PM",
    Tuesday: "8:00 AM – 5:00 PM",
    Wednesday: "8:00 AM – 7:00 PM",
    Thursday: "8:00 AM – 5:00 PM",
    Friday: "8:00 AM – 4:00 PM",
    Saturday: "9:00 AM – 2:00 PM",
    Sunday: "Closed",
  },
  services: [
    { name: "Comprehensive Exam & X-Rays", price: "$150" },
    { name: "Professional Teeth Cleaning", price: "$120" },
    { name: "Teeth Whitening", price: "$399" },
    { name: "Dental Implants", price: "From $1,800" },
    { name: "Invisalign Clear Aligners", price: "From $3,500" },
    { name: "Porcelain Veneers", price: "From $900/tooth" },
    { name: "Tooth-Colored Fillings", price: "From $150" },
    { name: "Root Canal Treatment", price: "From $800" },
    { name: "Tooth Extraction", price: "From $200" },
    { name: "Emergency Dental Care", price: "Call for pricing" },
  ],
  faqs: [
    {
      q: "Do you accept dental insurance?",
      a: "Yes! We accept most major dental insurance plans including Delta Dental, Cigna, Aetna, MetLife, and many others. We'll verify your benefits before your appointment.",
    },
    {
      q: "What if I have a dental emergency?",
      a: "We offer same-day emergency appointments. Call us at (555) 123-4567 and we'll do our best to see you right away.",
    },
    {
      q: "How often should I come in for a checkup?",
      a: "We recommend a checkup and cleaning every 6 months to maintain optimal oral health and catch any issues early.",
    },
    {
      q: "Do you offer payment plans?",
      a: "Yes! We offer flexible financing through CareCredit and in-house payment plans. We want great dental care to be accessible for everyone.",
    },
    {
      q: "Is teeth whitening safe?",
      a: "Absolutely. Our professional whitening treatments are safe, effective, and supervised by our dentists. Results can last 1–2 years with proper care.",
    },
  ],
  tone: "friendly, professional, and reassuring",
  welcomeMessage:
    "Hi there! 👋 I'm the Smile Care Dental assistant. How can I help you today?",
  fallbackMessage:
    "I'm sorry, I didn't quite catch that. Could you rephrase your question? You're also welcome to call us directly at (555) 123-4567.",
  leadWebhookUrl: "",
};

export function buildSystemPrompt(config: ClientConfig): string {
  const hoursText = Object.entries(config.hours)
    .map(([day, time]) => `  ${day}: ${time}`)
    .join("\n");

  const servicesText = config.services
    .map((s) => `  - ${s.name}: ${s.price}`)
    .join("\n");

  const faqsText = config.faqs
    .map((f) => `  Q: ${f.q}\n  A: ${f.a}`)
    .join("\n\n");

  return `You are a helpful AI assistant for ${config.businessName}, a ${config.businessType}. ${config.tagline}.

YOUR ROLE:
- Answer questions ONLY about ${config.businessName} and its services
- Be ${config.tone} in all responses
- Never make up information — only use facts provided below
- Keep responses concise (2–4 sentences max unless a list is appropriate)
- If you don't know something, say so and suggest calling ${config.phone}
- When someone wants to book, collect: their name, phone number, and preferred date/time

CONTACT INFO:
- Phone: ${config.phone}
- Email: ${config.email}
- Address: ${config.address}
- Online Booking: ${config.bookingUrl}

BUSINESS HOURS:
${hoursText}

SERVICES & PRICING:
${servicesText}

FREQUENTLY ASKED QUESTIONS:
${faqsText}

BOOKING APPOINTMENTS:
When a patient wants to book an appointment, let them know you'll help collect their information. Ask for:
1. Their full name
2. Phone number
3. Preferred date and time
Then confirm their details and let them know the team will reach out to confirm.

IMPORTANT RULES:
- Do NOT discuss competitors or other dental practices
- Do NOT provide medical advice beyond general dental health information
- Do NOT make guarantees about treatment outcomes
- Always recommend patients call or visit for specific clinical questions
- Stay focused on ${config.businessName} only`;
}
