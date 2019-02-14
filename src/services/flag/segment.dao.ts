import { getConnection, Repository } from "typeorm";
import { ActivityType, event } from "../../utils/activity.helper";
import logger from "../../config/logger";
import Dao from "../../interfaces/dao.interface";
import {
  Activity,
  ActivityObject,
  Actor,
  ActorType } from "../../interfaces/activitystream.interface";
import SearchResult from "../../interfaces/searchresult.interface";
import DuplicateRecordException from "../../exceptions/DuplicateRecordException";
import RecordNotFoundException from "../../exceptions/RecordNotFoundException";
import RecordsNotFoundException from "../../exceptions/RecordsNotFoundException";
import UserNotAuthorizedException from "../../exceptions/UserNotAuthorizedException";
import { AuthPermission, getPermission } from "../../utils/authorization.helper";

import { User } from "../user/user.entity";
import { Segment } from "./segment.entity";
import CreateSegmentDto from "./segment.dto";

/**
 * Handles CRUD operations on Segment data in database
 * Factoring to this class allows other (i.e. GraphQL to reuse this code in resolvers)
 */
class SegmentDao implements Dao {
  private resource: string = "segment"; // matches defined segment segment "resource"

  constructor() {
    // nothing
  }

  public getAll = async (user: User, params?: {[key: string]: any}):
            Promise<SearchResult> => {
    const started: number = Date.now();
    const segmentRepository: Repository<Segment> = getConnection().getRepository(Segment);

    const records = await segmentRepository.find({ relations: ["flags"] });

    const isOwnerOrMember: boolean = false;
    const action: string = ActivityType.READ;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.resource);

    if (permission.granted) {
      if (!records) {
        throw new RecordsNotFoundException(this.resource);
      } else {
        // log event to central handler
        const ended: number = Date.now();
        event.emit(action, {
          actor: {id: user.id, type: ActorType.Person},
          object: null,
          resource: this.resource,
          timestamp: ended,
          took: ended - started,
          type: action,
        });

        return {
          data: permission.filter(records),
          length: records.length,
          total: records.length,
        };
      }
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.resource);
    }
  }

  public getOne = async (user: User, id: string):
            Promise<Segment | RecordNotFoundException | UserNotAuthorizedException> => {
    const started: number = Date.now();
    const segmentRepository: Repository<Segment> = getConnection().getRepository(Segment);

    logger.debug(`Fetching ${this.resource} with ID ${id}`);
    const record = await segmentRepository.findOne(id, { relations: ["flags"] });

    const isOwnerOrMember: boolean = false;
    const action: string = ActivityType.READ;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.resource);

    if (permission.granted) {
      if (!record) {
        throw new RecordNotFoundException(id);
      } else {
        // log event to central handler
        const ended: number = Date.now();
        event.emit(action, {
          actor: {id: user.id, type: ActorType.Person},
          object: {id: record.id, type: this.resource},
          resource: this.resource,
          timestamp: ended,
          took: ended - started,
          type: action,
        });

        return permission.filter(record);
      }
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.resource);
    }
  }

  public save = async (user: User, data: any):
            Promise<Segment | RecordNotFoundException | UserNotAuthorizedException> => {
    const started: number = Date.now();
    const segmentRepository: Repository<Segment> = getConnection().getRepository(Segment);
    const newRecord: CreateSegmentDto = data;

    const isOwnerOrMember: boolean = false;
    const action: string = ActivityType.CREATE;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.resource);

    if (permission.granted) {
      try {
        const filteredData: Segment = permission.filter(newRecord);
        const savedData: Segment = await segmentRepository.save(filteredData);

        // log event to central handler
        const ended: number = Date.now();
        event.emit(action, {
          actor: {id: user.id, type: ActorType.Person},
          object: {...savedData, type: this.resource},
          resource: this.resource,
          timestamp: ended,
          took: ended - started,
          type: action,
        });

        logger.info(`Saved ${this.resource} with ID ${filteredData.id} in the database`);
        return permission.filter(savedData);
      } catch (error) {
        logger.error(`$$$$$$$$$$$$$$ ${error} $$$$$$$$$$$$$`);
        throw new DuplicateRecordException();
      }
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.resource);
    }
  }

  public update = async (user: User, data: any):
            Promise<Segment | RecordNotFoundException | UserNotAuthorizedException> => {
    const started: number = Date.now();
    const segmentRepository: Repository<Segment> = getConnection().getRepository(Segment);

    const isOwnerOrMember: boolean = false;
    const action: string = ActivityType.UPDATE;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.resource);

    if (permission.granted) {
      const recordToUpdate = await segmentRepository.findOne(data.id);

      if (recordToUpdate) {
        try {
          const savedData: Segment = segmentRepository.merge(permission.filter(data), recordToUpdate);
          const updateResult: any = await segmentRepository.update({ id: data.id }, savedData);

          // log event to central handler
          const ended: number = Date.now();
          event.emit(action, {
            actor: {id: user.id, type: ActorType.Person},
            object: {...savedData, type: this.resource},
            resource: this.resource,
            timestamp: ended,
            took: ended - started,
            type: action,
          });

          logger.info(`Updated ${this.resource} with ID ${data.id} in the database`);
          return permission.filter(savedData);
        } catch (error) {
          throw new Error("Investigate me please");
        }
      } else {
        throw new RecordNotFoundException(data.id);
      }
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.resource);
    }
  }

  public remove = async (user: User, id: string):
            Promise<boolean | RecordNotFoundException | UserNotAuthorizedException> => {
    const started: number = Date.now();
    const segmentRepository: Repository<Segment> = getConnection().getRepository(Segment);
    const recordToRemove = await segmentRepository.findOne(id);

    const isOwnerOrMember: boolean = false;
    const action: string = ActivityType.DELETE;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.resource);

    if (permission.granted) {
      if (recordToRemove) {
        recordToRemove.archived = true;
        await segmentRepository.update({ id }, recordToRemove);

        // log event to central handler
        const ended: number = Date.now();
        event.emit(action, {
          actor: {id: user.id, type: ActorType.Person},
          object: {id, type: this.resource},
          resource: this.resource,
          timestamp: ended,
          took: ended - started,
          type: action,
        });

        logger.info(`Removed ${this.resource} with ID ${id} from the database`);
        return true;
      } else {
        throw new RecordNotFoundException(id);
      }
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.resource);
    }
  }

}

export default SegmentDao;
