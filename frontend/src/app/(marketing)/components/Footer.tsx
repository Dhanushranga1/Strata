"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button, Chip } from "@heroui/react";
import { Github, Twitter, Linkedin, Mail, ArrowRight, Sparkles, Heart, Globe, Building, Users, Zap, Shield } from "lucide-react";
import { v } from "../../../ui/motion/variants";

const footerSections = [
  { 
    title: "Product", 
    icon: Zap,
    links: [
      { label: "AI Chat & RAG", href: "/features/ai-chat" },
      { label: "Knowledge Base", href: "/features/knowledge-base" },
      { label: "Smart Ticketing", href: "/features/ticketing" },
      { label: "Analytics", href: "/features/analytics" },
      { label: "API & Integrations", href: "/api" }
    ]
  },
  { 
    title: "Solutions", 
    icon: Building,
    links: [
      { label: "For Support Teams", href: "/solutions/support" },
      { label: "For Enterprises", href: "/solutions/enterprise" },
      { label: "For Startups", href: "/solutions/startups" },
      { label: "Customer Success", href: "/solutions/customer-success" }
    ]
  },
  { 
    title: "Resources", 
    icon: Globe,
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Help Center", href: "/help" },
      { label: "Blog & Guides", href: "/blog" },
      { label: "Status Page", href: "/status" },
      { label: "Changelog", href: "/changelog" }
    ]
  },
  { 
    title: "Company", 
    icon: Users,
    links: [
      { label: "About Us", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" }
    ]
  }
];

const socialLinks = [
  { icon: Twitter, href: "https://twitter.com/ticketpilot", label: "Follow on Twitter" },
  { icon: Linkedin, href: "https://linkedin.com/company/ticketpilot", label: "Connect on LinkedIn" },
  { icon: Github, href: "https://github.com/ticketpilot", label: "Star on GitHub" },
  { icon: Mail, href: "mailto:hello@ticketpilot.com", label: "Send us an email" }
];

const trustBadges = [
  { icon: Shield, text: "SOC 2 Type II" },
  { icon: Globe, text: "GDPR Compliant" },
  { icon: Zap, text: "99.9% Uptime" }
];

export default function Footer() {
  const { scrollYProgress } = useScroll();
  const footerY = useTransform(scrollYProgress, [0.8, 1], [0, -30]);

  return (
    <footer className="relative overflow-hidden bg-gradient-to-b from-background via-surface/50 to-background">
      {/* Subtle floating background elements - matching Hero pattern */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-primary/20 rounded-full blur-sm"
            style={{
              left: `${10 + i * 8}%`,
              top: `${20 + (i % 4) * 20}%`,
            }}
            animate={{
              y: [0, -15, 0],
              opacity: [0.2, 0.6, 0.2],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 5 + i * 0.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
          />
        ))}
      </div>

      <motion.div 
        className="relative mx-auto max-w-7xl px-6 py-20"
        style={{ y: footerY }}
      >
        <motion.div
          variants={v.list}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="space-y-16"
        >
          {/* Header Section */}
          <motion.div variants={v.item} className="text-center max-w-3xl mx-auto">
            {/* Brand with sophisticated animation */}
            <motion.div 
              className="flex items-center justify-center gap-4 mb-8"
              whileHover={{ scale: 1.02 }}
            >
              <div className="w-12 h-12 bg-gradient-to-br from-secondary/20 to-primary/20 backdrop-blur-xl border border-secondary/20 rounded-2xl flex items-center justify-center shadow-xl">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
                TicketPilot
              </h3>
            </motion.div>
            
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
              Transforming customer support with AI-powered insights, seamless knowledge management, and intelligent automation that actually works.
            </p>

            {/* Trust badges - matching Hero chips */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {trustBadges.map((badge, index) => (
                <motion.div
                  key={badge.text}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                  whileHover={{ scale: 1.05 }}
                >
                  <Chip 
                    startContent={<badge.icon className="size-3" />} 
                    variant="bordered"
                    size="sm"
                    className="border-border/30 bg-surface/30 backdrop-blur-sm hover:border-primary/50 transition-colors text-xs"
                  >
                    {badge.text}
                  </Chip>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Main Footer Grid */}
          <motion.div 
            variants={v.item}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12"
          >
            {footerSections.map((section, sectionIndex) => (
              <motion.div 
                key={section.title}
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 + sectionIndex * 0.1 }}
              >
                {/* Section Header */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-surface/50 border border-border/30 rounded-lg flex items-center justify-center">
                    <section.icon className="w-4 h-4 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider">
                    {section.title}
                  </h4>
                </div>
                
                {/* Section Links */}
                <ul className="space-y-3">
                  {section.links.map((link, linkIndex) => (
                    <motion.li 
                      key={link.label}
                      initial={{ opacity: 0, x: -15 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: 0.4 + sectionIndex * 0.1 + linkIndex * 0.05 }}
                    >
                      <Link
                        href={link.href}
                        className="text-muted-foreground hover:text-foreground hover:translate-x-2 transition-all duration-200 text-sm flex items-center gap-2 group py-1"
                      >
                        {link.label}
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-0 group-hover:translate-x-1" />
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>

          {/* Newsletter Section */}
          <motion.div 
            variants={v.item}
            className="bg-surface/30 backdrop-blur-xl border border-border/20 rounded-2xl p-8 text-center max-w-2xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h4 className="font-semibold text-foreground text-xl mb-3 flex items-center justify-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Stay in the loop
              </h4>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Get the latest product updates, support insights, and AI innovations delivered to your inbox.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="your@company.com"
                  className="flex-1 px-4 py-3 bg-background/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200 backdrop-blur-sm"
                />
                <Button
                  className="bg-gradient-to-r from-secondary to-primary text-white px-6 py-3 rounded-xl hover:from-secondary/90 hover:to-primary/90 transition-all duration-200 shadow-lg shadow-primary/20"
                  endContent={<ArrowRight className="w-4 h-4" />}
                >
                  Subscribe
                </Button>
              </div>
            </motion.div>
          </motion.div>

          {/* Social & Bottom Section */}
          <motion.div 
            variants={v.item}
            className="border-t border-border/20 pt-8 space-y-8"
          >
            {/* Social Links */}
            <div className="flex items-center justify-center gap-4">
              {socialLinks.map((social, index) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  className="w-12 h-12 bg-surface/50 backdrop-blur-sm border border-border/30 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 group"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
                  aria-label={social.label}
                  title={social.label}
                >
                  <social.icon className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                </motion.a>
              ))}
            </div>

            {/* Copyright & Login */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                © {new Date().getFullYear()} TicketPilot. Built with 
                <Heart className="w-4 h-4 text-red-500 animate-pulse" /> 
                for amazing support teams.
              </p>
              
              <Link 
                href="/login" 
                className="text-primary hover:text-secondary transition-colors duration-200 font-medium flex items-center gap-1"
              >
                Already have an account? Sign in
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </footer>
  );
}