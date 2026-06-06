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
    }
}
