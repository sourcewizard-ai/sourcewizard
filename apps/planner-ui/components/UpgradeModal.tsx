import DraggableWindow from './DraggableWindow';
import Image from 'next/image';
import { fonts } from '../lib/fonts';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'insufficient_credits' | 'role_required';
  creditsInfo: {
    remaining: number;
    total: number;
    used: number;
  } | null;
}

export default function UpgradeModal({
  isOpen,
  onClose,
  reason,
  creditsInfo,
}: UpgradeModalProps) {
  if (!isOpen) return null;

  const isRoleRequired = reason === 'role_required';
  const title = 'Thank you for using SourceWizard';

  return (
    <>
      {/* Modal Window */}
      <DraggableWindow
        title={title}
        onClose={onClose}
        zIndex={9999}
        initialWidth={800}
        initialHeight={500}
        resizable={false}
      >
        {/* Retro Pattern Header with Message */}
        <div
          className="w-full p-4 border-b border-gray-400 flex items-center justify-center"
          style={{
            backgroundColor: '#001f3f',
            backgroundImage: `
              repeating-conic-gradient(
                from 45deg at 0 0,
                #001f3f 0deg,
                #003366 45deg,
                #001f3f 90deg,
                #002244 135deg,
                #001f3f 180deg,
                #003366 225deg,
                #001f3f 270deg,
                #002244 315deg,
                #001f3f 360de g
              )
            `,
            backgroundSize: '16px 16px'
          }}
        >
          <p className="font-bold text-white" style={{ fontSize: '16px', fontFamily: 'var(--font-vollkorn)', textShadow: '2px 2px 0 #000' }}>
            Buy a license (subscription)
          </p>
        </div>

        <div className="p-1 overflow-y-auto h-full">

          {/* Two Column Layout */}
          <div className="grid grid-cols-2 gap-1 h-full">
            {/* Left side - Image */}
            <div className="flex items-center justify-center bg-white border-2 border-gray-400 p-2 relative">
              <Image
                src="/license.jpeg"
                alt="SourceWizard"
                width={1206}
                height={1192}
                className="max-w-full max-h-full object-contain"
                priority
              />
            </div>

            {/* Right side - Plans */}
            <div className="flex flex-col gap-2 h-full">
              {/* Credits Info */}
              {creditsInfo && (
                <div className="p-3 border-2 border-gray-400 bg-gray-50 flex-shrink-0">
                  <div className="text-sm">
                    <span className="font-bold">Remaining credits: </span>
                    <span className={creditsInfo.remaining === 0 ? 'text-red-600 font-bold text-lg' : 'font-bold text-lg'}>
                      {creditsInfo.remaining}
                    </span>
                  </div>
                </div>
              )}

              {/* Basic Plan */}
              <div className="p-4 border-2 border-blue-600 bg-white relative flex-1 flex flex-col">
                <div className="mb-3">
                  <h5 className="font-bold text-base mb-1">Usage-based subscription</h5>
                  <span className="text-sm font-bold">$9/mo</span>
                </div>

                <ul className="text-xs text-gray-700 space-y-2 mb-4">
                  <li>✓ 100 more credits monthly</li>
                  <li>✓ Generate multiple plans</li>
                  <li>✓ All integration types</li>
                  <li>✓ Usage-based billing</li>
                  <li>✓ Priority support</li>
                </ul>

                <a
                  href="https://buy.stripe.com/cNi14n8wW2u7bga1Z4cV204"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center cursor-pointer px-3 py-2 whitespace-nowrap overflow-hidden"
                  style={{
                    backgroundColor: "#c0c0c0",
                    border: "2px solid #000000",
                    boxShadow: "inset 2px 2px 0 #ffffff, inset -2px -2px 0 #808080",
                    color: "#000000",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    transform: "translate(0px, 0px)",
                    textDecoration: "none",
                    display: "inline-block",
                    fontWeight: "bold"
                  }}
                >
                  Subscribe Now
                </a>
              </div>
            </div>
          </div>
        </div>
      </DraggableWindow>
    </>
  );
}
