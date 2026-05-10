exports.handler = async (event) => {
  const user = event.clientContext && event.clientContext.user;
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      authenticated: !!user,
      tier: (user && user.app_metadata && user.app_metadata.tier) || 'free',
      email: user && user.email,
    }),
  };
};
