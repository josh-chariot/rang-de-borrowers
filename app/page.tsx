"use client";

import { useState } from "react";
import {
  Accordion,
  BottomBand,
  Button,
  CartBand,
  Icon,
  Input,
  Popup,
  Tabs,
  Tooltip,
} from "@/components/ui";

/** Component gallery for checking the design system. Safe to delete once real pages exist. */
export default function Gallery() {
  const [tab1, setTab1] = useState("a");
  const [tab2, setTab2] = useState("x");

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-r6 bg-white-100 p-r4">
      <h1 className="text-h3 font-medium">Component gallery</h1>

      <section className="flex flex-col gap-4">
        <h2 className="text-h5 font-bold uppercase">Buttons</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="pill">+ ₹1,000</Button>
          <Button variant="underlined">Underlined</Button>
          <Button status="success">Success</Button>
          <Button status="delete">Delete</Button>
          <Button disabled>Disabled</Button>
          <Button size="md" iconAfter={<Icon name="cart-arrow" />}>
            Medium
          </Button>
          <Button size="sm">Small</Button>
        </div>
        <div className="flex flex-wrap items-center gap-4 bg-text-grey-100 p-4">
          <Button tone="white">Primary</Button>
          <Button variant="secondary" tone="white">
            Secondary
          </Button>
          <Button variant="tertiary" tone="white">
            Tertiary
          </Button>
          <Button variant="pill" tone="white">
            + ₹1,000
          </Button>
          <Button variant="underlined" tone="white">
            Underlined
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-h5 font-bold uppercase">Inputs</h2>
        <Input label="Label" />
        <Input label="Label" defaultValue="Input Text" />
        <Input label="Label" defaultValue="Input Text" error="Error Message" />
        <Input label="Label" disabled />
        <Input variant="compact" placeholder="Input Text" />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-h5 font-bold uppercase">Tabs</h2>
        <Tabs
          items={[
            { id: "a", label: "Tab one" },
            { id: "b", label: "Tab two" },
            { id: "c", label: "Disabled", disabled: true },
          ]}
          value={tab1}
          onChange={setTab1}
        />
        <Tabs
          level={2}
          items={[
            { id: "x", label: "Tab one" },
            { id: "y", label: "Tab two" },
            { id: "z", label: "Disabled", disabled: true },
          ]}
          value={tab2}
          onChange={setTab2}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-h5 font-bold uppercase">Accordion</h2>
        <Accordion title="Accordion title goes here">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </Accordion>
        <Accordion title="Open by default" defaultOpen>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </Accordion>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-h5 font-bold uppercase">Tooltips</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Tooltip footer={{ label: "Total", value: "₹ 1,498" }}>
            Once any repayment of a loan is due more than 90 days, the entire outstanding principal
            is counted towards the NPA.
          </Tooltip>
          <Tooltip tone="tint" arrow="bottom" pointer="center">
            Tint tone, arrow at the bottom.
          </Tooltip>
          <Tooltip pointer="right" showPointer>
            Pointer on the right.
          </Tooltip>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-h5 font-bold uppercase">Popups</h2>
        <div className="grid grid-cols-1 gap-4 bg-bg-grey p-4 md:grid-cols-2">
          <Popup
            variant="default"
            title="What is an e-mandate?"
            text="An e-mandate allows automatic deductions from your bank account for recurring investments."
            timeline={[
              { label: "Disbursement", date: "16 Sep 2024", dateIsLink: true },
              { label: "", amount: "₹ 1,498", date: "18-20 Oct 2024" },
              { label: "", amount: "₹ 1,498", date: "18-20 Nov 2024" },
            ]}
          />
          <Popup
            variant="priority"
            title="Priority Investment Opportunity"
            text="This investee is seeking to fulfil their investment requirement at the earliest."
          />
          <Popup
            variant="centre"
            title="Compliance fee"
            text="The Compliance Fee is 2% of your investment amount, and is used for:"
            items={["KYC for Investee and Social Investor", "eSigning of loan agreements"]}
          />
          <Popup
            variant="xirr"
            headline="Upto 12% XIRR"
            text="As a P2P platform, we offer 100% of the repayments."
            note="As per RBI regulations, the platform does not provide any assurance."
          />
          <Popup
            variant="cta"
            text="Are you sure? Accepting this is necessary to proceed with the investment."
            primaryLabel="Accept"
            secondaryLabel="Uncheck and decline"
          />
        </div>
      </section>

      <section className="flex max-w-sm flex-col gap-4">
        <h2 className="text-h5 font-bold uppercase">Bottom bands</h2>
        <BottomBand
          variant="progress"
          title="₹30,000 left to invest"
          goalLabel="of ₹50,000 goal"
          progress={0.4}
          actionLabel="Invest"
        />
        <BottomBand
          variant="returns"
          returnsValue="Upto 12%"
          tenureValue="12 - 24 months"
          actionLabel="Invest"
        />
        <CartBand label="1 Investment added" />
      </section>
    </main>
  );
}
