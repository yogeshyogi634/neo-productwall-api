import prisma from "../utils/prisma.js";
import { success } from "../utils/response.js";

/**
 * GET /api/products
 * List all products ordered by their display order
 */
async function getProducts(req, res, next) {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    // Define custom display order: Collectbot → ProfileX → Perkle → Svitch → Blutic → Neokred
    const displayOrder = ["Collectbot", "ProfileX", "Perkle", "Svitch", "Blutic", "Neokred"];
    
    // Sort products according to display order
    const sortedProducts = products.sort((a, b) => {
      const indexA = displayOrder.indexOf(a.name);
      const indexB = displayOrder.indexOf(b.name);
      
      // If product not found in displayOrder, put it at the end
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      return indexA - indexB;
    });

    return success(res, sortedProducts);
  } catch (err) {
    next(err);
  }
}

export { getProducts };
