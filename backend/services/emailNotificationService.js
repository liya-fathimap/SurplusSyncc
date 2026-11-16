function createEmailNotificationService(transport) {
  return {
    async sendEmailNotification({ recipient, subject, text, html }) {
      if (!transport || typeof transport.sendMail !== 'function') {
        throw new Error('Email transport is not configured.');
      }

      return transport.sendMail({
        to: recipient,
        subject,
        text,
        html,
      });
    },
  };
}

module.exports = { createEmailNotificationService };
