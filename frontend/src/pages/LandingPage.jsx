import {
  ArrowRight,
  Boxes,
  ChartNoAxesCombined,
  Check,
  Clock3,
  HeartHandshake,
  Leaf,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Truck,
  UsersRound,
  Utensils,
} from 'lucide-react'
import Button from '../components/common/Button.jsx'
import Card from '../components/common/Card.jsx'
import FoodPhoto from '../components/common/FoodPhoto.jsx'
import Footer from '../components/layout/Footer.jsx'
import Navbar from '../components/layout/Navbar.jsx'

const steps = [
  {
    number: '01',
    icon: Boxes,
    title: 'Share surplus food',
    description:
      'Providers add what is available, how much there is, and when it can be collected.',
  },
  {
    number: '02',
    icon: HeartHandshake,
    title: 'Find the right partner',
    description:
      'Nearby verified organizations can discover suitable food and request what they need.',
  },
  {
    number: '03',
    icon: Truck,
    title: 'Coordinate collection',
    description:
      'Providers, organizations, and volunteers stay aligned from confirmation through pickup.',
  },
]

const benefits = [
  {
    icon: Clock3,
    title: 'Act before food expires',
    description:
      'Clear collection windows help partners make timely decisions and plan each handoff.',
  },
  {
    icon: ShieldCheck,
    title: 'Build trusted partnerships',
    description:
      'A shared workflow helps verified community organizations and providers coordinate with confidence.',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'See the difference',
    description:
      'Keep redistribution activity visible, organized, and easier to understand over time.',
  },
]

function LandingPage() {
  return (
    <div className="site-shell">
      <Navbar />
      <main>
        <section className="hero-section">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                Food rescued. Communities supported.
              </span>
              <h1>Good food deserves <span>another destination.</span></h1>
              <p className="hero-description">
                SurplusSync brings food providers, community organizations, and
                volunteers together to make surplus food easier to share.
              </p>
              <div className="hero-actions">
                <Button to="/register" size="large">
                  Join the network <ArrowRight aria-hidden="true" />
                </Button>
                <Button to="/#how-it-works" variant="secondary" size="large">
                  See how it works
                </Button>
              </div>
              <p className="hero-note">
                <Check aria-hidden="true" />
                A simpler way to turn extra food into community support.
              </p>
            </div>

            <div className="hero-visual" aria-label="Fresh food prepared for redistribution">
              <FoodPhoto alt="Fresh seasonal food prepared for sharing" category="produce" className="hero-food-photo" />
              <div className="hero-photo-caption">
                <span className="hero-photo-mark"><Leaf aria-hidden="true" /></span>
                <span><small>A local food network</small><strong>From a spare plate to a shared table.</strong></span>
                <MapPin aria-hidden="true" />
              </div>
              <span className="hero-photo-index">GOOD FOOD / GOOD JOURNEYS</span>
            </div>
          </div>
        </section>

        <section className="trust-strip" aria-label="The SurplusSync community">
          <div className="container trust-content">
            <strong>Built for the whole food-sharing community</strong>
            <span className="trust-item"><Utensils aria-hidden="true" /> Food providers</span>
            <span className="trust-item"><UsersRound aria-hidden="true" /> NGOs &amp; kitchens</span>
            <span className="trust-item"><Truck aria-hidden="true" /> Delivery volunteers</span>
          </div>
        </section>

        <section className="section" id="how-it-works">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">A connected process</span>
              <h2>From surplus to shared, in three steps.</h2>
              <p>
                A straightforward flow helps everyone know what is available,
                who is collecting it, and what happens next.
              </p>
            </div>
            <div className="steps-grid">
              {steps.map(({ description, icon: Icon, number, title }) => (
                <Card className="step-card" key={number}>
                  <div className="step-number-row">
                    <span className="step-icon"><Icon aria-hidden="true" /></span>
                    <span className="step-number">STEP {number}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="section benefits-section" id="benefits">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">Designed for real-world coordination</span>
              <h2>Make every handoff a little easier.</h2>
              <p>
                Bring the key details together so good food can reach the
                organizations and people who need it.
              </p>
            </div>
            <div className="benefits-grid">
              {benefits.map(({ description, icon: Icon, title }) => (
                <Card className="benefit-card" key={title}>
                  <span className="benefit-icon"><Icon aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="impact-section" id="impact">
          <div className="container impact-grid">
            <div className="impact-copy">
              <span className="eyebrow"><Leaf aria-hidden="true" /> Better outcomes, together</span>
              <h2>Make the impact of every food handoff visible.</h2>
              <p>
                Food redistribution is more than a pickup. By keeping the
                journey connected, partners can understand what was offered,
                what was collected, and what reached the community.
              </p>
              <ul className="impact-list">
                <li><Check aria-hidden="true" /> Track food from listing to collection</li>
                <li><Check aria-hidden="true" /> Recognize the partners behind each handoff</li>
                <li><Check aria-hidden="true" /> Build a clearer picture of redistribution over time</li>
              </ul>
            </div>
            <div className="impact-panel">
              <h3>A shared journey</h3>
              <p>Clear steps make progress easier to follow.</p>
              <div className="impact-flow">
                <div className="impact-stage">
                  <Boxes aria-hidden="true" />
                  <span>Food listed</span>
                </div>
                <ArrowRight className="impact-arrow" aria-hidden="true" />
                <div className="impact-stage">
                  <HeartHandshake aria-hidden="true" />
                  <span>Partner confirmed</span>
                </div>
                <ArrowRight className="impact-arrow" aria-hidden="true" />
                <div className="impact-stage">
                  <PackageCheck aria-hidden="true" />
                  <span>Food collected</span>
                </div>
              </div>
              <p className="impact-caption">Every completed step brings surplus closer to someone who can use it.</p>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="container">
            <div className="cta-card">
              <div>
                <h2>Be part of a better food system.</h2>
                <p>Join providers, community organizations, and volunteers making surplus count.</p>
              </div>
              <div className="cta-actions">
                <Button to="/register">Create an account <ArrowRight aria-hidden="true" /></Button>
                <Button to="/login" variant="secondary">Sign in</Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default LandingPage
