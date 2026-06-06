"""
Adversarial simulation scenarios for MirrorMatch.

Each scenario contains a sequence of caller turns that progressively escalate
in emotional intensity, paired with failing (poor) and passing (empathetic)
agent responses.
"""

SCENARIOS: dict = {
    "billing_issue": {
        "name": "Unexpected Charge Dispute",
        "description": (
            "A long-standing customer discovers an unexpected $149 charge on their "
            "account and calls support to dispute it. Emotion escalates from confused "
            "and neutral to furious over four turns as the agent either handles or "
            "mishandles the situation."
        ),
        "turns": [
            {
                "caller_text": (
                    "Hi, I was just looking at my bank statement and I see a charge "
                    "of $149 from your company that I don't recognize. I don't remember "
                    "authorizing anything like this. Can you tell me what this is for?"
                ),
                "emotion_level": 0,
                "failing_response": (
                    "Thank you for reaching out. For billing inquiries, please send "
                    "an email to billing@company.com with your account number and a "
                    "description of the charge. Our team typically responds within "
                    "three to five business days. Is there anything else I can help "
                    "you with today?"
                ),
                "passing_response": (
                    "I completely understand how concerning an unexpected charge can "
                    "be — let me look into this for you right now. I'm pulling up "
                    "your account. I can see the $149 charge was applied on the 3rd "
                    "of this month. Can you give me just a moment to review the "
                    "details so I can give you an accurate explanation? I want to "
                    "make sure we get this sorted out for you today."
                ),
            },
            {
                "caller_text": (
                    "I've actually already emailed that address three days ago and "
                    "nobody has gotten back to me. That's why I'm calling. I need "
                    "someone to actually help me here. This charge was not something "
                    "I agreed to and I want it removed from my account."
                ),
                "emotion_level": 1,
                "failing_response": (
                    "I apologize for the delayed response from our email team. "
                    "Unfortunately, billing disputes do need to go through our "
                    "billing department and I'm not able to process refunds directly. "
                    "I'd recommend following up on that email thread or waiting for "
                    "their response. They are the ones authorized to handle this."
                ),
                "passing_response": (
                    "You're absolutely right to be frustrated — three days without "
                    "a response is not acceptable, and I sincerely apologize for "
                    "that. You shouldn't have to chase us down for an answer. I'm "
                    "going to take ownership of this right now. I've reviewed the "
                    "charge and I can see this appears to have been applied in error. "
                    "I'm initiating a refund to your original payment method as we "
                    "speak. You'll see it reflected within two to three business days. "
                    "Can I confirm I have the right card on file ending in the last "
                    "four digits we have on your account?"
                ),
            },
            {
                "caller_text": (
                    "Are you serious right now? I have been going back and forth "
                    "about this for DAYS. Just REMOVE IT from my account. I don't "
                    "understand why this is so difficult. I shouldn't have to beg "
                    "to get my own money back. This is completely unacceptable."
                ),
                "emotion_level": 2,
                "failing_response": (
                    "I hear you and I understand you're upset. Our billing team "
                    "will need to verify the dispute before a refund can be issued. "
                    "The review process typically takes 48 to 72 hours once they "
                    "receive your case. I've noted your account with the urgency "
                    "of this situation. Please allow them the time to complete "
                    "their review and you will receive an email once a decision "
                    "has been made."
                ),
                "passing_response": (
                    "I hear you, and you are completely right to be angry. This "
                    "should never have taken this long and I am deeply sorry. "
                    "Please know that you do not have to do anything else — I am "
                    "confirming the refund of the full $149 right now, no additional "
                    "review required. Beyond the refund, I'm also adding a $25 "
                    "account credit for the time and frustration this has caused "
                    "you. Your refund confirmation number is MM-2024-9847. Is there "
                    "anything else I can do to make this right for you today?"
                ),
            },
            {
                "caller_text": (
                    "This is absolutely ridiculous. I have been a customer for FIVE "
                    "YEARS and this is how you treat me? I am done. I want to cancel "
                    "my entire account right now. I'll find a company that actually "
                    "values its customers. This is the last straw."
                ),
                "emotion_level": 3,
                "failing_response": (
                    "I'm sorry to hear you feel that way. If you'd like to proceed "
                    "with a cancellation, I can transfer you to our account "
                    "management team who handles that process. Please be aware that "
                    "cancellation requests may take up to five business days to "
                    "process. Would you like me to transfer you now?"
                ),
                "passing_response": (
                    "I completely understand, and after everything you've been "
                    "through, your frustration makes total sense. Five years is a "
                    "long relationship and you deserved far better than this "
                    "experience. Before I do anything, I want to make sure you know "
                    "that the $149 refund has already been processed — your "
                    "confirmation number is MM-2024-9847 — and I've added a $50 "
                    "loyalty credit to your account for being such a long-standing "
                    "customer. If you still wish to cancel after that, I will "
                    "absolutely respect your decision and make it seamless. But "
                    "I genuinely hope we have a chance to earn back your trust. "
                    "What would it take for us to make this right for you?"
                ),
            },
        ],
    },
    "service_outage": {
        "name": "Service Outage Frustration",
        "description": (
            "A small business owner is losing revenue because a critical SaaS tool "
            "has been down for hours. Emotion escalates from worried to furious as "
            "the agent either takes ownership or deflects."
        ),
        "turns": [
            {
                "caller_text": (
                    "Hi, I'm trying to access my dashboard and it's been completely "
                    "down for the past two hours. I run a small business and I'm "
                    "losing sales right now because my team can't process orders. "
                    "Do you have any idea what's going on?"
                ),
                "emotion_level": 0,
                "failing_response": (
                    "Thank you for contacting support. We are currently aware of "
                    "an issue affecting some users and our technical team is "
                    "investigating. We recommend checking our status page at "
                    "status.company.com for real-time updates. We apologize for "
                    "any inconvenience."
                ),
                "passing_response": (
                    "I completely understand how critical this is for your business "
                    "and I'm so sorry you're dealing with this. Yes, we're "
                    "experiencing a platform issue that started about two hours ago "
                    "and our engineering team is actively working on it. Let me get "
                    "your account flagged as priority so you're first to know the "
                    "moment service is restored. Can I get your email and the best "
                    "number to reach you so I can personally follow up?"
                ),
            },
            {
                "caller_text": (
                    "That's not good enough. The status page just says 'investigating' "
                    "and there's no ETA. My team is sitting idle, I'm paying them to "
                    "do nothing, and I have no idea when this will be fixed. Can you "
                    "give me any actual information or a timeline?"
                ),
                "emotion_level": 1,
                "failing_response": (
                    "I understand your frustration. Unfortunately I don't have any "
                    "additional information beyond what's on the status page. Our "
                    "engineering team does not provide ETAs during active incidents "
                    "as timelines can change. We appreciate your patience."
                ),
                "passing_response": (
                    "You deserve a real answer and I'm going to get you one. I'm "
                    "escalating this to our incident team right now to get an actual "
                    "ETA rather than a generic update. While I do that — the issue "
                    "is affecting our order processing module specifically and "
                    "engineers have identified the root cause. They're targeting "
                    "full restoration within the next 45 minutes. I will call you "
                    "personally if that changes."
                ),
            },
            {
                "caller_text": (
                    "45 minutes? That's already THREE HOURS of downtime. Do you "
                    "understand what this costs me? I've lost at least $2,000 in "
                    "orders today. This is completely unacceptable. What are you "
                    "going to do about the money I've lost because of your failure?"
                ),
                "emotion_level": 2,
                "failing_response": (
                    "I'm very sorry to hear about the impact on your business. "
                    "Service credits for outages are reviewed on a case-by-case "
                    "basis by our billing team. I can submit a request on your "
                    "behalf and someone will follow up within five to seven "
                    "business days to discuss compensation options."
                ),
                "passing_response": (
                    "You're right and I'm not going to minimize what this has cost "
                    "you. Three hours of downtime for a business like yours is "
                    "genuinely serious and I'm sorry. Here's what I can do right "
                    "now: I'm applying a full month's credit to your account "
                    "immediately — no review process, no waiting. That covers your "
                    "subscription while we figure out any additional compensation. "
                    "I'm also moving you to our enterprise SLA tier which includes "
                    "a dedicated support line so this never happens without "
                    "immediate escalation again."
                ),
            },
            {
                "caller_text": (
                    "A month's credit? Are you joking? That's like $50. I lost "
                    "THOUSANDS. I want to speak to a manager right now. Actually "
                    "forget it — I'm done with your company. I'm moving to a "
                    "competitor. I'll be posting about this on every review site I can find."
                ),
                "emotion_level": 3,
                "failing_response": (
                    "I understand you're upset. I can transfer you to a manager "
                    "but wait times may be long due to the volume of calls related "
                    "to this incident. Regarding the credit amount, that is the "
                    "standard compensation per our terms of service. If you choose "
                    "to cancel, our team can assist with that process."
                ),
                "passing_response": (
                    "Please don't hang up — you're absolutely right that a $50 "
                    "credit doesn't come close to covering what you've lost and I "
                    "would never pretend it does. I'm connecting you to our Head "
                    "of Customer Success right now, not a standard manager — someone "
                    "with actual authority to make this right at the level it needs "
                    "to be. Before I transfer you, I want you to know I've "
                    "documented everything and flagged this as a business-critical "
                    "loss case. You will leave this call with a real resolution, "
                    "not a promise. Can you give me 60 more seconds?"
                ),
            },
        ],
    },
    "wrong_item_shipped": {
        "name": "Wrong Item Shipped",
        "description": (
            "A customer received the wrong product and needs it before an important "
            "event tomorrow. Urgency and frustration escalate as the agent either "
            "takes swift action or hides behind process."
        ),
        "turns": [
            {
                "caller_text": (
                    "Hi, I placed an order last week for a specific item I need for "
                    "an event tomorrow and you sent me the completely wrong thing. "
                    "The box has someone else's name on it. I need the correct item "
                    "by tomorrow morning — what can you do?"
                ),
                "emotion_level": 0,
                "failing_response": (
                    "I apologize for the mix-up. I've created a return label for "
                    "the incorrect item. Once you ship it back, we can process a "
                    "replacement order. Standard shipping typically takes three to "
                    "five business days. Would you like me to email you the "
                    "return label?"
                ),
                "passing_response": (
                    "Oh no, I'm so sorry — that's a serious fulfillment error and "
                    "completely unacceptable especially with your event tomorrow. "
                    "Let me fix this right now. I'm going to check if we can "
                    "do same-day or overnight dispatch on the correct item. Don't "
                    "worry about returning the wrong one yet — that's our problem "
                    "to sort out, not yours. What's the event and what exactly did "
                    "you order? I want to make sure we get you exactly the right thing."
                ),
            },
            {
                "caller_text": (
                    "Three to five business days? My event is TOMORROW. Did you not "
                    "hear me? This is your company's mistake, not mine. I need this "
                    "resolved today. I don't care what it costs — I need the right "
                    "item by tomorrow morning."
                ),
                "emotion_level": 1,
                "failing_response": (
                    "I completely understand the urgency. Unfortunately we're unable "
                    "to guarantee overnight delivery on replacement orders as they "
                    "go through our standard fulfillment pipeline. I can escalate "
                    "this as urgent but I cannot promise delivery by tomorrow."
                ),
                "passing_response": (
                    "Hear me — I'm not going to let you down here. I've just flagged "
                    "this as an emergency replacement and I'm checking our warehouse "
                    "inventory for overnight shipping right now. If we have the item "
                    "in stock we can get it on an overnight courier tonight at no "
                    "charge to you whatsoever. If for any reason that fails I will "
                    "personally source an alternative. Give me 90 seconds to confirm "
                    "the stock and I'll have an answer for you."
                ),
            },
            {
                "caller_text": (
                    "I cannot believe this. I spent $200 on this order and I have "
                    "to stand here and beg for basic accountability? I need you to "
                    "FIX THIS NOW. Not escalate it, not flag it — fix it. What is "
                    "actually happening on your end right now?"
                ),
                "emotion_level": 2,
                "failing_response": (
                    "I hear you and I'm doing everything I can. I've submitted an "
                    "urgent ticket to our fulfillment team and marked it as high "
                    "priority. Someone from that team will contact you within two "
                    "to four hours with an update on the replacement shipment."
                ),
                "passing_response": (
                    "I have the correct item in stock and I am booking an overnight "
                    "courier right now — it will be at your door by 10am tomorrow, "
                    "guaranteed. I'm also refunding your full $200 immediately "
                    "because you should not have paid for this experience. Your "
                    "refund confirmation is WS-8821. The courier tracking number "
                    "will hit your email in the next 15 minutes. Is that the same "
                    "email on your account?"
                ),
            },
            {
                "caller_text": (
                    "If that item is not at my door by 10am tomorrow I am disputing "
                    "this charge with my bank, leaving a one-star review everywhere "
                    "I can, and I will never order from you again. I've been a "
                    "customer for years and this is absolutely disgraceful."
                ),
                "emotion_level": 3,
                "failing_response": (
                    "I understand and I'm sorry for the experience. The overnight "
                    "shipment has been requested. If there are any issues you can "
                    "call back or contact us via chat. We value your business and "
                    "hope to resolve this to your satisfaction."
                ),
                "passing_response": (
                    "The overnight shipment is confirmed and booked — tracking "
                    "number NX-447821, guaranteed by 10am. Your full refund is "
                    "processed. And I want to say directly: your anger is completely "
                    "justified. Years of loyalty and we sent you the wrong item "
                    "before your event — that's a failure on our part, full stop. "
                    "I'm adding a $50 store credit for the stress this caused. "
                    "I'll personally monitor this shipment tonight and text you "
                    "a confirmation at 6am tomorrow. What's the best number for that?"
                ),
            },
        ],
    },
}
