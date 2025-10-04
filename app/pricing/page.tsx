import { title } from "@/components/primitives";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import Link from "next/link";

export default function PricingPage() {
  const pricingTiers = [
    {
      name: "LEO Constellation",
      description: "Low Earth Orbit satellites - Fast, frequent passes",
      price: "$10-15",
      unit: "per minute",
      features: [
        "Iridium, Globalstar, Orbcomm satellites",
        "100+ Mbps data rates",
        "20-40ms latency",
        "Global ground station access",
        "Real-time tracking",
        "15 min - 4 hour bookings",
      ],
      popular: false,
      satellites: "50+ satellites available",
    },
    {
      name: "Geostationary",
      description: "Fixed-position satellites - Consistent coverage",
      price: "$25",
      unit: "per minute",
      features: [
        "GOES, GEO communication satellites",
        "Up to 500 Mbps data rates",
        "40-60ms latency",
        "Continuous coverage areas",
        "Priority ground station routing",
        "Extended booking windows",
        "Perfect for weather & monitoring",
      ],
      popular: true,
      satellites: "30+ satellites available",
    },
    {
      name: "Premium Fleet",
      description: "High-capacity commercial satellites",
      price: "$30",
      unit: "per minute",
      features: [
        "Intelsat, SES premium satellites",
        "Up to 1 Gbps data rates",
        "30-50ms latency",
        "Dedicated bandwidth allocation",
        "Multi-ground station diversity",
        "24/7 technical support",
        "Mission planning assistance",
        "Data relay services",
      ],
      popular: false,
      satellites: "20+ satellites available",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <div className="text-center mb-12">
        <h1 className={title()}>Pricing</h1>
        <p className="text-xl text-gray-400 mt-4 max-w-2xl mx-auto">
          Pay-per-use satellite access with our global ground station network. 
          No subscriptions, no setup fees - just book what you need.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {pricingTiers.map((tier) => (
          <Card
            key={tier.name}
            className={tier.popular ? "border-2 border-primary" : ""}
          >
            {tier.popular && (
              <div className="absolute top-0 right-0 bg-primary text-white px-4 py-1 rounded-bl-lg rounded-tr-lg text-sm font-bold">
                POPULAR
              </div>
            )}
            <CardHeader className="flex flex-col items-start gap-2 pt-8">
              <h3 className="text-2xl font-bold">{tier.name}</h3>
              <p className="text-sm text-gray-400">{tier.description}</p>
              <div className="mt-4">
                <span className="text-4xl font-bold text-primary">{tier.price}</span>
                <span className="text-gray-400 ml-2">{tier.unit}</span>
              </div>
              <Chip size="sm" variant="flat">
                {tier.satellites}
              </Chip>
            </CardHeader>
            <CardBody>
              <ul className="space-y-3 mb-6">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <svg
                      className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/">
                <Button
                  color={tier.popular ? "primary" : "default"}
                  fullWidth
                  size="lg"
                >
                  Book Now
                </Button>
              </Link>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Network Advantage Section */}
      <Card className="mb-16">
        <CardHeader>
          <h2 className="text-2xl font-bold">The Thunderlink Advantage</h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4 text-red-400">
                ❌ Traditional Hobbyist Setup
              </h3>
              <ul className="space-y-3 text-gray-400">
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Can only connect when satellite passes directly overhead</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Limited to your local ground station location</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Connection windows of only 5-15 minutes</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Unpredictable access times</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Expensive hardware investment ($5,000+)</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Complex setup and maintenance</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4 text-green-400">
                ✅ With Thunderlink Network
              </h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex gap-2">
                  <span>🌍</span>
                  <span>
                    <strong>Global Access:</strong> Connect to any satellite, anywhere, anytime
                  </span>
                </li>
                <li className="flex gap-2">
                  <span>📡</span>
                  <span>
                    <strong>19 Ground Stations:</strong> Worldwide coverage on 6 continents
                  </span>
                </li>
                <li className="flex gap-2">
                  <span>⏰</span>
                  <span>
                    <strong>Extended Windows:</strong> Book 15 minutes to 4 hours
                  </span>
                </li>
                <li className="flex gap-2">
                  <span>📅</span>
                  <span>
                    <strong>Flexible Scheduling:</strong> Reserve time slots in advance
                  </span>
                </li>
                <li className="flex gap-2">
                  <span>💰</span>
                  <span>
                    <strong>Pay-per-use:</strong> No upfront costs or subscriptions
                  </span>
                </li>
                <li className="flex gap-2">
                  <span>🚀</span>
                  <span>
                    <strong>Instant Access:</strong> Start using immediately
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Ground Stations Map Info */}
      <Card className="mb-16">
        <CardHeader>
          <h2 className="text-2xl font-bold">Global Ground Station Network</h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">North America</h4>
              <ul className="space-y-1 text-gray-400">
                <li>🇺🇸 Alaska</li>
                <li>🇺🇸 California</li>
                <li>🇺🇸 Virginia</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">Europe</h4>
              <ul className="space-y-1 text-gray-400">
                <li>🇩🇪 Germany</li>
                <li>🇬🇧 UK</li>
                <li>🇪🇸 Spain</li>
                <li>🇳🇴 Norway</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">Asia</h4>
              <ul className="space-y-1 text-gray-400">
                <li>🇯🇵 Japan</li>
                <li>🇸🇬 Singapore</li>
                <li>🇮🇳 India</li>
                <li>🇰🇷 South Korea</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">South America</h4>
              <ul className="space-y-1 text-gray-400">
                <li>🇧🇷 Brazil</li>
                <li>🇨🇱 Chile</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">Oceania</h4>
              <ul className="space-y-1 text-gray-400">
                <li>🇦🇺 Australia</li>
                <li>🇳🇿 New Zealand</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">Africa</h4>
              <ul className="space-y-1 text-gray-400">
                <li>🇿🇦 South Africa</li>
                <li>🇰🇪 Kenya</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">Middle East</h4>
              <ul className="space-y-1 text-gray-400">
                <li>🇦🇪 UAE</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">Polar</h4>
              <ul className="space-y-1 text-gray-400">
                <li>🇦🇶 Antarctica</li>
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* FAQ Section */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-6">Example Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card>
            <CardBody className="text-center">
              <div className="text-3xl mb-2">🔬</div>
              <h3 className="font-semibold mb-2">Quick Experiment</h3>
              <p className="text-sm text-gray-400 mb-4">
                LEO satellite, 15 minutes
              </p>
              <div className="text-2xl font-bold text-green-400">$150 - $225</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-3xl mb-2">📡</div>
              <h3 className="font-semibold mb-2">Standard Mission</h3>
              <p className="text-sm text-gray-400 mb-4">
                GEO satellite, 1 hour
              </p>
              <div className="text-2xl font-bold text-green-400">$1,500</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-3xl mb-2">🛰️</div>
              <h3 className="font-semibold mb-2">Extended Research</h3>
              <p className="text-sm text-gray-400 mb-4">
                Premium satellite, 4 hours
              </p>
              <div className="text-2xl font-bold text-green-400">$7,200</div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

