import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { TransactionContext, TransactionRunner } from 'src/common/database';
import { Role, UnitType } from 'src/common/enums';
import { BusinessException } from 'src/common/errors';
import { InventoryService } from 'src/modules/inventory';
import { OrderStatus, OrdersService } from 'src/modules/orders';
import { ProductsService } from 'src/modules/products';
import { SubstitutionReason, SubstitutionStatus } from './schemas';
import { SubstitutionDocument } from './schemas';
import { SubstitutionsService } from './substitutions.service';
import { SubstitutionDecision } from './dto';

const STORE_A = new Types.ObjectId('64b000000000000000000001');
const ORDER_ID = new Types.ObjectId('64b000000000000000000101');
const CUSTOMER_ID = new Types.ObjectId('64b000000000000000000009');
const MANAGER_ID = '64b00000000000000000000a';

const MILK = new Types.ObjectId('64b000000000000000000201');
const OTHER_MILK = new Types.ObjectId('64b000000000000000000202');
const BREAD = new Types.ObjectId('64b000000000000000000203');

type MockModel = Record<string, jest.Mock>;

/** A runner that just executes the body, recording the compensations offered. */
function passthroughRunner(): TransactionRunner & { compensations: string[] } {
  const compensations: string[] = [];

  const runner = {
    compensations,
    run: async <T>(work: (context: TransactionContext) => Promise<T>): Promise<T> => {
      const context: TransactionContext = {
        session: null,
        compensate: (label: string) => {
          compensations.push(label);
        },
      } as unknown as TransactionContext;

      return work(context);
    },
  };

  return runner as unknown as TransactionRunner & { compensations: string[] };
}

function orderForEdit(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    userId: CUSTOMER_ID,
    orderNumber: 'FC-2026-0000001',
    status: OrderStatus.PREPARING,
    statusLabel: 'Preparing',
    items: [
      {
        productId: MILK,
        productName: "Olper's Full Cream Milk",
        productImage: null,
        brand: "Olper's",
        sku: 'FC-DAI-001',
        unitLabel: '1 L',
        unitType: UnitType.LITER,
        unitValue: 1,
        quantity: 2,
        unitPrice: 240,
        lineTotal: 480,
      },
      {
        productId: BREAD,
        productName: 'Dawn Milky Bread',
        productImage: null,
        brand: 'Dawn',
        sku: 'FC-BAK-001',
        unitLabel: '1 pc',
        unitType: UnitType.PIECE,
        unitValue: 1,
        quantity: 1,
        unitPrice: 180,
        lineTotal: 180,
      },
    ],
    ...overrides,
  };
}

function replacement(sellingPrice: number, id = OTHER_MILK) {
  return {
    product: {
      _id: id,
      name: 'MilkPak Full Cream Milk',
      sku: 'FC-DAI-002',
      sellingPrice,
      unitType: UnitType.LITER,
      unitValue: 1.5,
      images: [],
    },
    stock: { quantity: 50, lowStockThreshold: 5, status: 'IN_STOCK', isAvailable: true },
  };
}

describe('SubstitutionsService', () => {
  let substitutionModel: MockModel;
  let ordersService: jest.Mocked<
    Pick<OrdersService, 'loadStoreOrderForEdit' | 'applySubstitution'>
  >;
  let productsService: jest.Mocked<Pick<ProductsService, 'findPurchasableOrFail'>>;
  let inventoryService: jest.Mocked<Pick<InventoryService, 'tryReserve' | 'release'>>;
  let runner: ReturnType<typeof passthroughRunner>;
  let service: SubstitutionsService;

  const scope = { storeId: STORE_A, actorId: MANAGER_ID, actorRole: Role.STORE_MANAGER };

  beforeEach(() => {
    substitutionModel = {
      create: jest.fn().mockImplementation((docs: Array<Record<string, unknown>>) => [
        {
          ...docs[0],
          _id: new Types.ObjectId('64b000000000000000000401'),
          createdAt: new Date('2026-08-31T10:00:00Z'),
          updatedAt: new Date('2026-08-31T10:00:00Z'),
          toObject: () => ({
            ...docs[0],
            _id: new Types.ObjectId('64b000000000000000000401'),
            createdAt: new Date('2026-08-31T10:00:00Z'),
            updatedAt: new Date('2026-08-31T10:00:00Z'),
          }),
        },
      ]),
      findOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn().mockReturnValue({ exec: () => Promise.resolve(0) }),
    };

    ordersService = {
      loadStoreOrderForEdit: jest.fn().mockResolvedValue(orderForEdit()),
      applySubstitution: jest.fn().mockResolvedValue(undefined),
    } as never;

    productsService = {
      findPurchasableOrFail: jest.fn().mockResolvedValue(replacement(200)),
    } as never;

    inventoryService = {
      tryReserve: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockResolvedValue(undefined),
    } as never;

    runner = passthroughRunner();

    service = new SubstitutionsService(
      substitutionModel as unknown as Model<SubstitutionDocument>,
      ordersService as unknown as OrdersService,
      productsService as unknown as ProductsService,
      inventoryService as unknown as InventoryService,
      runner,
    );
  });

  const propose = (overrides: Record<string, unknown> = {}) =>
    service.propose(scope, ORDER_ID.toHexString(), MILK.toHexString(), {
      replacementProductId: OTHER_MILK.toHexString(),
      reason: SubstitutionReason.OUT_OF_STOCK,
      ...overrides,
    } as never);

  describe('the editable window', () => {
    it('accepts a CONFIRMED order', async () => {
      ordersService.loadStoreOrderForEdit.mockResolvedValue(
        orderForEdit({ status: OrderStatus.CONFIRMED, statusLabel: 'Confirmed' }) as never,
      );

      await expect(propose()).resolves.toBeDefined();
    });

    it('accepts a PREPARING order', async () => {
      await expect(propose()).resolves.toBeDefined();
    });

    it('refuses a PENDING order — confirm or reject it first', async () => {
      ordersService.loadStoreOrderForEdit.mockResolvedValue(
        orderForEdit({ status: OrderStatus.PENDING, statusLabel: 'Order placed' }) as never,
      );

      await expect(propose()).rejects.toMatchObject({
        code: 'SUBSTITUTION_ORDER_NOT_EDITABLE',
      });
    });

    it('refuses a PACKED order — the bag is sealed', async () => {
      ordersService.loadStoreOrderForEdit.mockResolvedValue(
        orderForEdit({ status: OrderStatus.PACKED, statusLabel: 'Packed' }) as never,
      );

      await expect(propose()).rejects.toBeInstanceOf(BusinessException);
    });

    it('refuses a delivered order', async () => {
      ordersService.loadStoreOrderForEdit.mockResolvedValue(
        orderForEdit({ status: OrderStatus.DELIVERED, statusLabel: 'Delivered' }) as never,
      );

      await expect(propose()).rejects.toBeInstanceOf(BusinessException);
    });
  });

  describe('store scope', () => {
    it('loads the order through the store-scoped lookup', async () => {
      await propose();

      expect(ordersService.loadStoreOrderForEdit).toHaveBeenCalledWith(
        STORE_A,
        ORDER_ID.toHexString(),
      );
    });

    it('reads the replacement from the catalogue scoped to the same store', async () => {
      await propose();

      expect(productsService.findPurchasableOrFail).toHaveBeenCalledWith(
        OTHER_MILK.toHexString(),
        STORE_A,
      );
    });
  });

  describe('validation', () => {
    it('refuses a line that is not on the order', async () => {
      await expect(
        service.propose(scope, ORDER_ID.toHexString(), new Types.ObjectId().toHexString(), {
          replacementProductId: OTHER_MILK.toHexString(),
          reason: SubstitutionReason.OUT_OF_STOCK,
        } as never),
      ).rejects.toMatchObject({ code: 'SUBSTITUTION_INVALID' });
    });

    it('refuses substituting a product for itself', async () => {
      await expect(propose({ replacementProductId: MILK.toHexString() })).rejects.toMatchObject({
        code: 'SUBSTITUTION_INVALID',
      });
    });

    it('refuses a replacement already on the order', async () => {
      // Two lines for one product would break the "a product appears once per
      // order" assumption the line-identification scheme rests on.
      await expect(propose({ replacementProductId: BREAD.toHexString() })).rejects.toMatchObject({
        code: 'SUBSTITUTION_INVALID',
      });
    });

    it('refuses a replacement with too little stock to set aside', async () => {
      productsService.findPurchasableOrFail.mockResolvedValue({
        ...replacement(200),
        stock: { quantity: 1, lowStockThreshold: 5, status: 'LOW_STOCK', isAvailable: true },
      } as never);

      await expect(propose()).rejects.toMatchObject({
        code: 'SUBSTITUTION_REPLACEMENT_UNAVAILABLE',
      });
      expect(inventoryService.tryReserve).not.toHaveBeenCalled();
    });

    it('reports the race when the replacement sells out mid-proposal', async () => {
      inventoryService.tryReserve.mockResolvedValue(false);

      await expect(propose()).rejects.toMatchObject({
        code: 'SUBSTITUTION_REPLACEMENT_UNAVAILABLE',
      });
      expect(substitutionModel.create).not.toHaveBeenCalled();
    });

    it('translates the unique-index race into "already open"', async () => {
      substitutionModel.create.mockRejectedValue(
        Object.assign(new Error('E11000'), { code: 11000 }),
      );

      await expect(propose()).rejects.toMatchObject({ code: 'SUBSTITUTION_ALREADY_OPEN' });
    });
  });

  /**
   * THE PRICE RULE — the most important behaviour in this module.
   *
   * A substitution must never increase what the shopper pays, and must never
   * move the order total.
   */
  describe('the price rule', () => {
    it('allows a cheaper replacement', async () => {
      productsService.findPurchasableOrFail.mockResolvedValue(replacement(200) as never);

      const view = await propose();

      // 2 × 200 = 400 against an agreed 480.
      expect(view.chargedLineTotal).toBe(480);
      expect(view.replacement.catalogueLineTotal).toBe(400);
    });

    it('allows an equally priced replacement', async () => {
      productsService.findPurchasableOrFail.mockResolvedValue(replacement(240) as never);

      await expect(propose()).resolves.toMatchObject({ chargedLineTotal: 480 });
    });

    it('refuses a dearer replacement outright', async () => {
      // 2 × 300 = 600 against an agreed 480. Not offered as an upcharge —
      // re-quoting an order is checkout's job, not a picker's.
      productsService.findPurchasableOrFail.mockResolvedValue(replacement(300) as never);

      await expect(propose()).rejects.toMatchObject({
        code: 'SUBSTITUTION_PRICE_INCREASE',
      });
    });

    it('reports the shortfall so the manager can see the gap', async () => {
      productsService.findPurchasableOrFail.mockResolvedValue(replacement(300) as never);

      let caught: BusinessException | undefined;
      try {
        await propose();
      } catch (error) {
        caught = error as BusinessException;
      }

      expect(caught?.details).toMatchObject({
        chargedLineTotal: 480,
        catalogueLineTotal: 600,
        difference: 120,
      });
    });

    it('always charges the agreed line total, never the replacement price', async () => {
      productsService.findPurchasableOrFail.mockResolvedValue(replacement(100) as never);

      const view = await propose();

      expect(view.chargedLineTotal).toBe(480);
    });

    it('records what the store absorbs, which is zero for a cheaper swap', async () => {
      productsService.findPurchasableOrFail.mockResolvedValue(replacement(200) as never);

      expect((await propose()).storeAbsorbs).toBe(0);
    });

    it('refuses a quantity the agreed total cannot divide evenly', async () => {
      // 480 / 7 is not a whole number of rupees, and `unitPrice × quantity ===
      // lineTotal` has to stay exact.
      productsService.findPurchasableOrFail.mockResolvedValue(replacement(10) as never);

      await expect(propose({ replacementQuantity: 7 })).rejects.toMatchObject({
        code: 'SUBSTITUTION_INVALID',
      });
    });

    it('allows a quantity that divides evenly', async () => {
      productsService.findPurchasableOrFail.mockResolvedValue(replacement(10) as never);

      await expect(propose({ replacementQuantity: 4 })).resolves.toBeDefined();
    });
  });

  describe('inventory choreography', () => {
    it('sets the replacement aside when the proposal is made, not when it is accepted', async () => {
      await propose();

      expect(inventoryService.tryReserve).toHaveBeenCalledWith(OTHER_MILK, STORE_A, 2, null);
    });

    it('registers an undo for the reservation', async () => {
      await propose();

      expect(runner.compensations).toEqual([expect.stringContaining('return replacement stock')]);
    });

    it('does not touch the original line until the customer agrees', async () => {
      await propose();

      expect(inventoryService.release).not.toHaveBeenCalled();
      expect(ordersService.applySubstitution).not.toHaveBeenCalled();
    });
  });

  describe('attribution', () => {
    it('records the acting principal, never a value from the request', async () => {
      await propose();

      const [[docs]] = substitutionModel.create.mock.calls;
      expect(docs[0]).toMatchObject({
        createdByUserId: new Types.ObjectId(MANAGER_ID),
        createdByRole: Role.STORE_MANAGER,
        storeId: STORE_A,
        userId: CUSTOMER_ID,
      });
    });

    it('snapshots both products so the record survives a rename', async () => {
      await propose();
      const [[docs]] = substitutionModel.create.mock.calls;

      expect(docs[0]).toMatchObject({
        originalProductName: "Olper's Full Cream Milk",
        originalUnitLabel: '1 L',
        chargedUnitPrice: 240,
        replacementProductName: 'MilkPak Full Cream Milk',
        replacementUnitLabel: '1.5 L',
      });
    });
  });

  describe('decide', () => {
    function openProposal(overrides: Record<string, unknown> = {}) {
      const document = {
        _id: new Types.ObjectId('64b000000000000000000401'),
        orderId: ORDER_ID,
        storeId: STORE_A,
        userId: CUSTOMER_ID,
        originalProductId: MILK,
        originalProductName: "Olper's Full Cream Milk",
        originalUnitLabel: '1 L',
        originalQuantity: 2,
        chargedUnitPrice: 240,
        replacementProductId: OTHER_MILK,
        replacementProductName: 'MilkPak Full Cream Milk',
        replacementUnitLabel: '1.5 L',
        replacementQuantity: 2,
        replacementUnitPrice: 200,
        status: SubstitutionStatus.PROPOSED,
        reason: SubstitutionReason.OUT_OF_STOCK,
        note: null,
        createdByUserId: new Types.ObjectId(MANAGER_ID),
        createdByRole: Role.STORE_MANAGER,
        resolvedAt: null,
        resolvedByRole: null,
        createdAt: new Date('2026-08-31T10:00:00Z'),
        updatedAt: new Date('2026-08-31T10:00:00Z'),
        save: jest.fn(),
        ...overrides,
      };
      document.save.mockResolvedValue(document);
      (document as unknown as { toObject: () => unknown }).toObject = () => ({ ...document });

      substitutionModel.findOne.mockReturnValue({
        session: () => ({ exec: () => Promise.resolve(document) }),
      });

      return document;
    }

    it('scopes the lookup to the answering shopper', async () => {
      openProposal();

      await service.decide(CUSTOMER_ID.toHexString(), '64b000000000000000000401', {
        decision: SubstitutionDecision.REJECT,
      });

      expect(substitutionModel.findOne).toHaveBeenCalledWith({
        _id: new Types.ObjectId('64b000000000000000000401'),
        userId: CUSTOMER_ID,
      });
    });

    it('reports a proposal that is not theirs as not found', async () => {
      substitutionModel.findOne.mockReturnValue({
        session: () => ({ exec: () => Promise.resolve(null) }),
      });

      await expect(
        service.decide(CUSTOMER_ID.toHexString(), '64b000000000000000000401', {
          decision: SubstitutionDecision.ACCEPT,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('swaps the line and returns the original stock on acceptance', async () => {
      const document = openProposal();

      await service.decide(CUSTOMER_ID.toHexString(), '64b000000000000000000401', {
        decision: SubstitutionDecision.ACCEPT,
      });

      expect(ordersService.applySubstitution).toHaveBeenCalledWith(
        ORDER_ID,
        { originalProductId: MILK, replacementProductId: OTHER_MILK, replacementQuantity: 2 },
        null,
      );
      // The original's units go back only now — until the shopper agreed, they
      // were still the right thing to be holding.
      expect(inventoryService.release).toHaveBeenCalledWith(MILK, STORE_A, 2, null);
      expect(document.status).toBe(SubstitutionStatus.ACCEPTED);
    });

    it('returns the replacement and leaves the order alone on rejection', async () => {
      const document = openProposal();

      await service.decide(CUSTOMER_ID.toHexString(), '64b000000000000000000401', {
        decision: SubstitutionDecision.REJECT,
      });

      expect(inventoryService.release).toHaveBeenCalledWith(OTHER_MILK, STORE_A, 2, null);
      expect(ordersService.applySubstitution).not.toHaveBeenCalled();
      expect(document.status).toBe(SubstitutionStatus.REJECTED);
    });

    it('refuses to answer a proposal that is already resolved', async () => {
      openProposal({ status: SubstitutionStatus.ACCEPTED });

      await expect(
        service.decide(CUSTOMER_ID.toHexString(), '64b000000000000000000401', {
          decision: SubstitutionDecision.REJECT,
        }),
      ).rejects.toMatchObject({ code: 'SUBSTITUTION_INVALID' });
    });

    it('attributes the resolution to the customer', async () => {
      const document = openProposal();

      await service.decide(CUSTOMER_ID.toHexString(), '64b000000000000000000401', {
        decision: SubstitutionDecision.ACCEPT,
      });

      expect(document.resolvedByRole).toBe(Role.CUSTOMER);
      expect(document.resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe('cancel', () => {
    it('scopes the lookup to the withdrawing store', async () => {
      const document = {
        _id: new Types.ObjectId('64b000000000000000000401'),
        storeId: STORE_A,
        replacementProductId: OTHER_MILK,
        replacementQuantity: 2,
        originalQuantity: 2,
        chargedUnitPrice: 240,
        replacementUnitPrice: 200,
        originalProductId: MILK,
        originalProductName: 'x',
        originalUnitLabel: '1 L',
        replacementProductName: 'y',
        replacementUnitLabel: '1.5 L',
        orderId: ORDER_ID,
        status: SubstitutionStatus.PROPOSED,
        reason: SubstitutionReason.OUT_OF_STOCK,
        note: null,
        createdByRole: Role.STORE_MANAGER,
        createdAt: new Date(),
        resolvedAt: null,
        resolvedByRole: null,
        save: jest.fn(),
      };
      document.save.mockResolvedValue(document);
      (document as unknown as { toObject: () => unknown }).toObject = () => ({ ...document });

      substitutionModel.findOne.mockReturnValue({
        session: () => ({ exec: () => Promise.resolve(document) }),
      });

      await service.cancel(
        { storeId: STORE_A, actorRole: Role.STORE_MANAGER },
        '64b000000000000000000401',
      );

      expect(substitutionModel.findOne).toHaveBeenCalledWith({
        _id: new Types.ObjectId('64b000000000000000000401'),
        storeId: STORE_A,
      });
      expect(inventoryService.release).toHaveBeenCalledWith(OTHER_MILK, STORE_A, 2, null);
      expect(document.status).toBe(SubstitutionStatus.CANCELLED);
    });

    it("reports another store's proposal as not found", async () => {
      substitutionModel.findOne.mockReturnValue({
        session: () => ({ exec: () => Promise.resolve(null) }),
      });

      await expect(
        service.cancel(
          { storeId: new Types.ObjectId(), actorRole: Role.STORE_MANAGER },
          '64b000000000000000000401',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
