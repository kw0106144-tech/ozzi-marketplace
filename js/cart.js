/* OZZI CART - local cart engine */
(function () {
  const KEY = "ozzi_cart";

  function getCart() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem(KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent("ozzi:cart-updated", { detail: cart }));
  }

  function addToCart(product) {
    const cart = getCart();
    const existing = cart.find(item => String(item.id) === String(product.id));
    if (existing) existing.quantity += product.quantity || 1;
    else cart.push({ ...product, quantity: product.quantity || 1 });
    saveCart(cart);
    return cart;
  }

  function removeFromCart(id) {
    saveCart(getCart().filter(item => String(item.id) !== String(id)));
  }

  function updateQuantity(id, quantity) {
    const cart = getCart();
    const item = cart.find(item => String(item.id) === String(id));
    if (!item) return;
    item.quantity = Math.max(1, Number(quantity) || 1);
    saveCart(cart);
  }

  function clearCart() {
    saveCart([]);
  }

  function cartCount() {
    return getCart().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }

  window.ozziCart = { getCart, addToCart, removeFromCart, updateQuantity, clearCart, cartCount };
})();